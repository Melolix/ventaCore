import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { WhatsappNotificationEntity } from './entities/whatsapp-notification.entity';
import { WhatsappRecipientsService } from './whatsapp-recipients.service';

/** Lo mínimo que el envío necesita saber de una pregunta nueva de ML. */
export interface NewQuestionNotification {
	/** Id interno (uuid) de la pregunta. Clave de dedupe del aviso. */
	questionId: string;
	rubroId: string;
	espacioId: string;
	/** Texto de la pregunta del comprador. */
	text: string;
	/** Nombre del producto preguntado (si se conoce). */
	itemTitle?: string | null;
}

/**
 * Envío SALIENTE de WhatsApp (F1): avisa por WhatsApp cuando entra una pregunta
 * nueva de Mercado Libre. Usa la Cloud API con una plantilla *utility* aprobada.
 *
 * Es **best-effort**: si WhatsApp no está configurado (falta env) o el rubro no
 * tiene destinatario, loguea y sigue — nunca rompe la ingesta de preguntas.
 *
 * Al enviar, guarda el `wamid` que devuelve Meta en `whatsapp_notifications`: esa
 * es la clave con la que después se rutea la respuesta citada (F2).
 */
@Injectable()
export class WhatsappService {
	private readonly logger = new Logger(WhatsappService.name);

	constructor(
		@InjectRepository(WhatsappNotificationEntity)
		private readonly notifications: Repository<WhatsappNotificationEntity>,
		private readonly recipients: WhatsappRecipientsService,
	) {}

	private get config() {
		return {
			phoneId: process.env.WHATSAPP_PHONE_ID?.trim(),
			token: process.env.WHATSAPP_TOKEN?.trim(),
			template: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || 'pregunta_ml',
			lang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'es_AR',
			version: process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0',
		};
	}

	/** ¿Está configurada la Cloud API (número + token)? */
	get configured(): boolean {
		const { phoneId, token } = this.config;
		return Boolean(phoneId && token);
	}

	/**
	 * Avisa una pregunta nueva al destinatario del rubro. Idempotente por
	 * `questionId` (si ya se avisó, no reenvía). No lanza: los errores se loguean
	 * y se guardan en la notificación.
	 */
	async notifyNewQuestion(input: NewQuestionNotification): Promise<void> {
		try {
			if (!this.configured) {
				this.logger.log(`WhatsApp no configurado; se omite aviso de la pregunta ${input.questionId}`);
				return;
			}

			// Dedupe: ¿ya hay un aviso no-fallido para esta pregunta?
			const existing = await this.notifications.findOne({
				where: { questionId: input.questionId, status: Not('failed') },
			});
			if (existing) return;

			const recipient = await this.recipients.findEntity(input.rubroId, input.espacioId);
			if (!recipient || !recipient.active) {
				this.logger.log(`Rubro ${input.rubroId} sin destinatario activo; se omite aviso`);
				return;
			}

			const notif = this.notifications.create({
				rubroId: input.rubroId,
				espacioId: input.espacioId,
				questionId: input.questionId,
				recipientId: recipient.id,
				status: 'pending',
			});
			await this.notifications.save(notif);

			const to = recipient.waId || recipient.phoneE164.replace(/\D/g, '');
			const bodyText = this.buildBody(input);

			try {
				const wamid = await this.sendTemplate(to, bodyText);
				notif.waMessageId = wamid;
				notif.status = 'sent';
				await this.notifications.save(notif);
			} catch (e) {
				notif.status = 'failed';
				notif.error = (e as Error).message;
				await this.notifications.save(notif);
				this.logger.error(`Falló el envío de WhatsApp para la pregunta ${input.questionId}: ${notif.error}`);
			}
		} catch (e) {
			// Nunca propagar: la ingesta de preguntas no debe romperse por WhatsApp.
			this.logger.error(`Error inesperado avisando la pregunta ${input.questionId}: ${(e as Error).message}`);
		}
	}

	/**
	 * Envía un mensaje de texto libre (sesión). Solo funciona dentro de la ventana
	 * de 24hs desde el último mensaje del usuario → lo usamos para CONFIRMAR una
	 * respuesta recién recibida. Best-effort: si falla, loguea y sigue.
	 */
	async sendText(to: string, text: string): Promise<void> {
		if (!this.configured) return;
		const { phoneId, token, version } = this.config;
		try {
			const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify({
					messaging_product: 'whatsapp',
					to,
					type: 'text',
					text: { body: text },
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
				this.logger.warn(`No se pudo enviar confirmación a ${to}: ${body.error?.message || res.status}`);
			}
		} catch (e) {
			this.logger.warn(`Error enviando confirmación a ${to}: ${(e as Error).message}`);
		}
	}

	/** Arma el parámetro del cuerpo de la plantilla (pregunta + producto). */
	private buildBody(input: NewQuestionNotification): string {
		const q = (input.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
		const prod = input.itemTitle?.trim();
		// WhatsApp no permite saltos de línea ni tabs en parámetros de plantilla.
		return prod ? `${prod}: ${q}` : q;
	}

	/**
	 * Envía la plantilla utility y devuelve el `wamid`. Un único parámetro de
	 * cuerpo (`{{1}}`) con la pregunta. Lanza si Meta responde error.
	 */
	private async sendTemplate(to: string, bodyText: string): Promise<string> {
		const { phoneId, token, template, lang, version } = this.config;
		const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify({
				messaging_product: 'whatsapp',
				to,
				type: 'template',
				template: {
					name: template,
					language: { code: lang },
					components: [{ type: 'body', parameters: [{ type: 'text', text: bodyText }] }],
				},
			}),
		});
		const body = (await res.json().catch(() => ({}))) as {
			messages?: Array<{ id?: string }>;
			error?: { message?: string; code?: number };
		};
		if (!res.ok) throw new Error(body.error?.message || `HTTP ${res.status}`);
		const wamid = body.messages?.[0]?.id;
		if (!wamid) throw new Error('Meta no devolvió el id del mensaje (wamid)');
		return wamid;
	}
}
