import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { MlQuestionsService } from '../sales/ml-questions.service';
import { WhatsappNotificationEntity } from './entities/whatsapp-notification.entity';
import { WhatsappInboundEntity } from './entities/whatsapp-inbound.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappRecipientsService } from './whatsapp-recipients.service';

/** Forma (parcial) del webhook de WhatsApp Cloud API que nos interesa. */
interface WaWebhook {
	entry?: Array<{
		changes?: Array<{
			field?: string;
			value?: {
				messages?: WaMessage[];
				statuses?: WaStatus[];
			};
		}>;
	}>;
}
interface WaMessage {
	from?: string;
	id?: string;
	type?: string;
	text?: { body?: string };
	context?: { id?: string };
}
interface WaStatus {
	id?: string;
	status?: string;
}

/**
 * Entrante de WhatsApp (F2): recibe la respuesta del dueño/CM, la rutea a la
 * pregunta de ML por el mensaje CITADO (`context.id` === `waMessageId` del aviso)
 * y publica la respuesta en Mercado Libre.
 *
 * Depende de `MlQuestionsService` (publica en ML) con `forwardRef`: `SalesModule`
 * ya importa `WhatsappModule` (F1 saliente) → hay ciclo de módulos, y así se rompe.
 */
@Injectable()
export class WhatsappInboundService {
	private readonly logger = new Logger(WhatsappInboundService.name);

	constructor(
		@InjectRepository(WhatsappNotificationEntity)
		private readonly notifications: Repository<WhatsappNotificationEntity>,
		@InjectRepository(WhatsappInboundEntity)
		private readonly inbound: Repository<WhatsappInboundEntity>,
		private readonly whatsapp: WhatsappService,
		@Inject(forwardRef(() => MlQuestionsService))
		private readonly questions: MlQuestionsService,
	) {}

	/**
	 * Valida la firma `X-Hub-Signature-256` contra el body CRUDO con el App Secret.
	 * Si no hay secret configurado, no se puede verificar → se rechaza (fail-closed).
	 */
	verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
		const secret = process.env.WHATSAPP_APP_SECRET?.trim();
		if (!secret || !rawBody || !header) return false;
		const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
		const a = Buffer.from(expected, 'utf8');
		const b = Buffer.from(header, 'utf8');
		return a.length === b.length && timingSafeEqual(a, b);
	}

	/** Verifica la firma y procesa el webhook (sin bloquear la respuesta 200). */
	async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
		if (!this.verifySignature(rawBody, signature)) {
			this.logger.warn('Webhook de WhatsApp con firma inválida; ignorado');
			return;
		}
		let payload: WaWebhook;
		try {
			payload = JSON.parse((rawBody as Buffer).toString('utf8')) as WaWebhook;
		} catch {
			this.logger.warn('Webhook de WhatsApp con JSON inválido');
			return;
		}

		for (const entry of payload.entry ?? []) {
			for (const change of entry.changes ?? []) {
				const value = change.value ?? {};
				for (const st of value.statuses ?? []) await this.applyStatus(st);
				for (const msg of value.messages ?? []) await this.processMessage(msg);
			}
		}
	}

	/** Refleja los acuses de entrega (sent/delivered/read) en la notificación. */
	private async applyStatus(st: WaStatus): Promise<void> {
		if (!st.id || !st.status) return;
		const notif = await this.notifications.findOne({ where: { waMessageId: st.id } });
		// No pisar un estado terminal ('answered'/'failed') con un acuse de entrega.
		if (!notif || notif.status === 'answered' || notif.status === 'failed') return;
		notif.status = st.status; // 'sent' | 'delivered' | 'read'
		await this.notifications.save(notif);
	}

	/**
	 * Procesa un mensaje entrante: dedupe por wamid, rutea por la cita y publica en
	 * ML. Cada rama deja el `whatsapp_inbound` con un estado explicativo.
	 */
	private async processMessage(msg: WaMessage): Promise<void> {
		const wamid = msg.id;
		if (!wamid) return;

		// Dedupe: si ya lo procesamos (Meta reintenta), salir. La UNIQUE de wamid
		// es el respaldo definitivo ante carreras.
		if (await this.inbound.findOne({ where: { waMessageId: wamid } })) return;

		const row = this.inbound.create({
			waMessageId: wamid,
			fromWaId: msg.from ?? '',
			contextWamid: msg.context?.id ?? null,
			text: msg.text?.body ?? null,
			status: 'received',
			raw: msg as unknown as Record<string, unknown>,
		});

		// Meta puede devolver el número CON el "9" (549…), pero la cuenta suele estar
		// en formato canónico SIN el 9 (54…). Normalizamos el destino de la respuesta
		// para que coincida (mismo criterio que el destinatario saliente).
		const replyTo = WhatsappRecipientsService.toWaId(row.fromWaId);

		try {
			if (msg.type !== 'text' || !row.text?.trim()) {
				row.status = 'ignored';
				row.error = 'mensaje sin texto';
				await this.save(row);
				return;
			}
			if (!row.contextWamid) {
				row.status = 'unrouted';
				row.error = 'respuesta sin cita';
				await this.save(row);
				await this.whatsapp.sendText(
					replyTo,
					'Para publicar la respuesta necesito que la mandes *citando* (respondiendo a) el mensaje del aviso.',
				);
				return;
			}

			const notif = await this.notifications.findOne({ where: { waMessageId: row.contextWamid } });
			if (!notif) {
				row.status = 'unrouted';
				row.error = 'cita desconocida';
				await this.save(row);
				return;
			}
			if (notif.status === 'answered') {
				row.status = 'ignored';
				row.error = 'la pregunta ya fue respondida';
				await this.save(row);
				await this.whatsapp.sendText(replyTo, 'Esa pregunta ya estaba respondida. 👍');
				return;
			}

			// Despacha la respuesta según el origen del aviso.
			if (notif.kind === 'ml_question') {
				// Publica en ML reutilizando la lógica del panel (POST /answers).
				await this.questions.answer(notif.rubroId, notif.espacioId, notif.sourceId, row.text.trim());
			} else {
				// 'ig_dm' y otros se implementan en el paso siguiente.
				throw new Error(`Tipo de aviso no soportado aún: ${notif.kind}`);
			}

			notif.status = 'answered';
			await this.notifications.save(notif);
			row.status = 'processed';
			await this.save(row);
			await this.whatsapp.sendText(replyTo, '✅ Respuesta publicada en Mercado Libre.');
		} catch (e) {
			row.status = 'failed';
			row.error = (e as Error).message;
			await this.save(row);
			this.logger.error(`Error procesando respuesta ${wamid}: ${row.error}`);
			await this.whatsapp.sendText(replyTo, `❌ No se pudo publicar la respuesta: ${row.error}`);
		}
	}

	private async save(row: WhatsappInboundEntity): Promise<void> {
		try {
			await this.inbound.save(row);
		} catch (e) {
			// Choque de UNIQUE (wamid duplicado por carrera): ya está registrado, ok.
			this.logger.warn(`No se pudo guardar el entrante ${row.waMessageId}: ${(e as Error).message}`);
		}
	}
}
