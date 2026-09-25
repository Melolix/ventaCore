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
	/** Nombre del negocio/rubro (para que el CM sepa de cuál es). */
	businessName?: string | null;
}

/** Lo mínimo que el envío necesita saber de un DM nuevo de Instagram. */
export interface NewDmNotification {
	/** Id interno (uuid) del DM (`instagram_messages.id`). Clave de dedupe del aviso. */
	dmId: string;
	rubroId: string;
	espacioId: string;
	/** Texto del DM del cliente. */
	text: string;
	/** Nombre del negocio/rubro (para que el CM sepa de cuál es). */
	businessName?: string | null;
	/** Quién escribió (usuario de IG), si se conoce. */
	senderName?: string | null;
}

/**
 * Envío SALIENTE de WhatsApp: avisa al destinatario del rubro cuando entra algo
 * para responder — una pregunta de Mercado Libre o un DM de Instagram. Usa la Cloud
 * API con una plantilla *utility* aprobada (una por tipo).
 *
 * Es **best-effort**: si WhatsApp no está configurado (falta env) o el rubro no
 * tiene destinatario, loguea y sigue — nunca rompe la ingesta.
 *
 * Al enviar, guarda el `wamid` que devuelve Meta en `whatsapp_notifications` con su
 * `kind`+`sourceId`: esa es la clave con la que después se rutea la respuesta citada.
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
			version: process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0',
			// Plantilla de preguntas de ML.
			qTemplate: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || 'pregunta_ml',
			qLang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'es_AR',
			// Plantilla de DMs de Instagram.
			dmTemplate: process.env.WHATSAPP_DM_TEMPLATE_NAME?.trim() || 'dm_instagram',
			dmLang: process.env.WHATSAPP_DM_TEMPLATE_LANG?.trim() || 'es_AR',
		};
	}

	/** ¿Está configurada la Cloud API (número + token)? */
	get configured(): boolean {
		const { phoneId, token } = this.config;
		return Boolean(phoneId && token);
	}

	/**
	 * Avisa una pregunta nueva de ML. Idempotente por la pregunta; best-effort.
	 */
	async notifyNewQuestion(input: NewQuestionNotification): Promise<void> {
		await this.dispatchNotification({
			rubroId: input.rubroId,
			espacioId: input.espacioId,
			kind: 'ml_question',
			sourceId: input.questionId,
			params: this.buildQuestionParams(input),
			template: this.config.qTemplate,
			lang: this.config.qLang,
			label: `pregunta ${input.questionId}`,
		});
	}

	/**
	 * Avisa un DM nuevo de Instagram. Idempotente por el DM; best-effort.
	 */
	async notifyNewDm(input: NewDmNotification): Promise<void> {
		await this.dispatchNotification({
			rubroId: input.rubroId,
			espacioId: input.espacioId,
			kind: 'ig_dm',
			sourceId: input.dmId,
			params: this.buildDmParams(input),
			template: this.config.dmTemplate,
			lang: this.config.dmLang,
			label: `DM ${input.dmId}`,
		});
	}

	/**
	 * Crea la notificación y manda la plantilla al destinatario del rubro. Idempotente
	 * por (kind, sourceId). No lanza: los errores se loguean y se guardan.
	 */
	private async dispatchNotification(opts: {
		rubroId: string;
		espacioId: string;
		kind: string;
		sourceId: string;
		params: string[];
		template: string;
		lang: string;
		label: string;
	}): Promise<void> {
		try {
			if (!this.configured) {
				this.logger.log(`WhatsApp no configurado; se omite aviso de ${opts.label}`);
				return;
			}

			// Dedupe: ¿ya hay un aviso no-fallido para este origen?
			const existing = await this.notifications.findOne({
				where: { kind: opts.kind, sourceId: opts.sourceId, status: Not('failed') },
			});
			if (existing) return;

			const recipient = await this.recipients.findEntity(opts.rubroId, opts.espacioId);
			if (!recipient || !recipient.active) {
				this.logger.log(`Rubro ${opts.rubroId} sin destinatario activo; se omite aviso`);
				return;
			}

			const notif = this.notifications.create({
				rubroId: opts.rubroId,
				espacioId: opts.espacioId,
				kind: opts.kind,
				sourceId: opts.sourceId,
				recipientId: recipient.id,
				status: 'pending',
			});
			await this.notifications.save(notif);

			const to = recipient.waId || recipient.phoneE164.replace(/\D/g, '');
			try {
				const wamid = await this.sendTemplate(to, opts.params, opts.template, opts.lang);
				notif.waMessageId = wamid;
				notif.status = 'sent';
				await this.notifications.save(notif);
			} catch (e) {
				notif.status = 'failed';
				notif.error = (e as Error).message;
				await this.notifications.save(notif);
				this.logger.error(`Falló el envío de WhatsApp para ${opts.label}: ${notif.error}`);
			}
		} catch (e) {
			// Nunca propagar: la ingesta no debe romperse por WhatsApp.
			this.logger.error(`Error inesperado avisando ${opts.label}: ${(e as Error).message}`);
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

	/** Colapsa espacios/saltos de línea, recorta y aplica fallback (WhatsApp no acepta vacíos ni saltos en params). */
	private clean(s: string | null | undefined, fallback: string, max: number): string {
		const v = (s || '').replace(/\s+/g, ' ').trim().slice(0, max);
		return v || fallback;
	}

	/** Params de la plantilla de preguntas: {{1}} negocio, {{2}} producto, {{3}} pregunta. */
	private buildQuestionParams(input: NewQuestionNotification): string[] {
		return [
			this.clean(input.businessName, 'Tu negocio', 60),
			this.clean(input.itemTitle, 'Publicación', 100),
			this.clean(input.text, '(sin texto)', 300),
		];
	}

	/** Params de la plantilla de DMs: {{1}} negocio, {{2}} de quién, {{3}} mensaje. */
	private buildDmParams(input: NewDmNotification): string[] {
		return [
			this.clean(input.businessName, 'Tu negocio', 60),
			this.clean(input.senderName, 'un cliente', 60),
			this.clean(input.text, '(sin texto)', 300),
		];
	}

	/**
	 * Envía la plantilla utility y devuelve el `wamid`. `params` llena en orden los
	 * `{{1}}`, `{{2}}`… del cuerpo. Lanza si Meta responde error.
	 */
	private async sendTemplate(to: string, params: string[], template: string, lang: string): Promise<string> {
		const { phoneId, token, version } = this.config;
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
					components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
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
