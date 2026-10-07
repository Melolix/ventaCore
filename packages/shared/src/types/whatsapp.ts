/**
 * WhatsApp para responder preguntas de Mercado Libre. Vistas públicas para el
 * panel: NUNCA incluyen el token de WhatsApp (vive en el entorno de plataforma).
 */

/**
 * El destinatario que recibe por WhatsApp las preguntas de un rubro. UNO por
 * rubro (el dueño O el CM). El número que ENVÍA es único de plataforma; esto es
 * a quién se le manda.
 */
export interface WhatsappRecipientView {
	id: string;
	rubroId: string;
	/** Teléfono en formato E.164 (ej: +5493511234567). */
	phoneE164: string;
	/** Rol informativo: 'dueño' | 'cm' | null. */
	role: string | null;
	/** Nombre para mostrar en el panel, o null. */
	displayName: string | null;
	/** Si está activo (se le avisa) o pausado. */
	active: boolean;
	createdAt: string;
}
