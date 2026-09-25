import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { MetaConnectionService } from '../social/meta-connection.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { InstagramMessageEntity } from './entities/instagram-message.entity';

/** Forma (parcial) del webhook de mensajería de Instagram que nos interesa. */
interface IgWebhook {
	object?: string;
	entry?: Array<{
		id?: string; // id de la cuenta de IG del negocio
		messaging?: IgMessagingEvent[];
	}>;
}
interface IgMessagingEvent {
	sender?: { id?: string };
	recipient?: { id?: string };
	message?: { mid?: string; text?: string; is_echo?: boolean };
}

/**
 * Entrante de Instagram (DMs): recibe los mensajes directos de clientes, los guarda
 * y avisa por WhatsApp (reusa `WhatsappService`). La respuesta llega por el entrante
 * de WhatsApp (el CM responde citando) y se despacha con `kind='ig_dm'`.
 *
 * Firma: mismo esquema que WhatsApp (`X-Hub-Signature-256` HMAC del raw body), pero
 * con el App Secret de Meta (`META_APP_SECRET`) — es la misma app.
 */
@Injectable()
export class InstagramInboundService {
	private readonly logger = new Logger(InstagramInboundService.name);

	constructor(
		@InjectRepository(InstagramMessageEntity)
		private readonly inbound: Repository<InstagramMessageEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly meta: MetaConnectionService,
		@Inject(forwardRef(() => WhatsappService))
		private readonly whatsapp: WhatsappService,
	) {}

	/** Valida `X-Hub-Signature-256` contra el body crudo con el App Secret de Meta. Fail-closed. */
	verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
		const secret = process.env.META_APP_SECRET?.trim();
		if (!secret || !rawBody || !header) return false;
		const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
		const a = Buffer.from(expected, 'utf8');
		const b = Buffer.from(header, 'utf8');
		return a.length === b.length && timingSafeEqual(a, b);
	}

	/** Verifica la firma y procesa el webhook (sin bloquear la respuesta 200). */
	async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
		if (!this.verifySignature(rawBody, signature)) {
			this.logger.warn('Webhook de Instagram con firma inválida; ignorado');
			return;
		}
		let payload: IgWebhook;
		try {
			payload = JSON.parse((rawBody as Buffer).toString('utf8')) as IgWebhook;
		} catch {
			this.logger.warn('Webhook de Instagram con JSON inválido');
			return;
		}

		for (const entry of payload.entry ?? []) {
			const igAccountId = entry.id ?? '';
			for (const event of entry.messaging ?? []) {
				await this.processMessage(igAccountId, event);
			}
		}
	}

	/** Guarda un DM entrante (dedupe por mid), resuelve el rubro y avisa por WhatsApp. */
	private async processMessage(igAccountId: string, event: IgMessagingEvent): Promise<void> {
		const msg = event.message;
		// Ignoramos ecos (mensajes que mandó el propio negocio) y lo que no sea texto.
		if (!msg || msg.is_echo || !msg.text?.trim()) return;
		const mid = msg.mid;
		if (!mid) return;

		// Dedupe: Meta reintenta los webhooks.
		if (await this.inbound.findOne({ where: { igMessageId: mid } })) return;

		// Resolver a qué rubro pertenece esa cuenta de IG.
		const target = await this.meta.resolveTargetByIgAccount(igAccountId || event.recipient?.id || '');
		if (!target) {
			this.logger.warn(`DM de IG para cuenta ${igAccountId} sin rubro conectado; se ignora`);
			return;
		}

		const row = this.inbound.create({
			rubroId: target.rubroId,
			espacioId: target.espacioId,
			igMessageId: mid,
			senderId: event.sender?.id ?? '',
			recipientIgId: igAccountId || null,
			text: msg.text.trim(),
			status: 'received',
			raw: event as unknown as Record<string, unknown>,
		});
		if (!(await this.save(row))) return; // choque de UNIQUE (carrera): ya está

		try {
			const rubro = await this.rubros.findOne({ where: { id: target.rubroId } });
			await this.whatsapp.notifyNewDm({
				dmId: row.id,
				rubroId: target.rubroId,
				espacioId: target.espacioId,
				text: msg.text.trim(),
				businessName: rubro?.nombre ?? null,
				// El username del CLIENTE no viene en el webhook (solo su IGSID) → "un cliente".
				senderName: null,
			});
			row.status = 'notified';
			await this.save(row);
		} catch (e) {
			row.status = 'failed';
			row.error = (e as Error).message;
			await this.save(row);
			this.logger.error(`Error avisando DM ${mid}: ${row.error}`);
		}
	}

	/** Guarda la fila; devuelve false si chocó la UNIQUE (dedupe por carrera). */
	private async save(row: InstagramMessageEntity): Promise<boolean> {
		try {
			await this.inbound.save(row);
			return true;
		} catch (e) {
			this.logger.warn(`No se pudo guardar el DM ${row.igMessageId}: ${(e as Error).message}`);
			return false;
		}
	}
}
