/**
 * Integración con redes sociales. Hoy: Meta (Facebook + Instagram).
 *
 * Cada espacio (negocio) conecta su cuenta de Meta vía OAuth. Guardamos los
 * tokens **cifrados** en la base y los destinos publicables (Páginas de
 * Facebook y, si existe, la cuenta de Instagram Business vinculada a cada una).
 *
 * IMPORTANTE: los tipos de esta vista NUNCA incluyen tokens ni secretos. Los
 * tokens viven solo en las entidades del backend (cifrados) y jamás se
 * serializan hacia el frontend.
 */

/**
 * Estado de Meta de un rubro para el panel. Cada rubro trae su propia app
 * (modelo BYO): primero configura App ID/Secret, después conecta por OAuth.
 * Nunca incluye el App Secret ni tokens.
 */
export interface MetaRubroState {
	/** ¿El rubro ya cargó las credenciales de su app de Meta? */
	appConfigured: boolean;
	/** App ID configurado (público), para mostrar/prefilar. null si no hay. */
	appId: string | null;
	/** Conexión OAuth (null si configuró la app pero todavía no autorizó). */
	connection: MetaConnection | null;
}

/** Redes de Meta a las que se puede publicar. */
export type MetaNetwork = 'facebook' | 'instagram';

/** Resultado de publicar un producto en una red concreta. */
export interface MetaPublishResult {
	network: MetaNetwork;
	ok: boolean;
	/** ID del post/media publicado (si ok). */
	id?: string;
	/** Mensaje de error (si !ok). */
	error?: string;
}

/** Estado de la conexión OAuth de un espacio con Meta. */
export enum MetaConnectionStatus {
	/** Conexión activa y token vigente. */
	CONNECTED = 'connected',
	/** El token long-lived venció (~60 días) → hay que reconectar. */
	EXPIRED = 'expired',
	/** El usuario revocó los permisos desde Meta → hay que reconectar. */
	REVOKED = 'revoked',
}

/**
 * Un destino publicable: una Página de Facebook y, si tiene una vinculada,
 * su cuenta de Instagram Business. El admin habilita los que quiera usar.
 */
export interface MetaTarget {
	id: string;
	/** ID de la Página de Facebook. */
	pageId: string;
	/** Nombre de la Página (para mostrar en el panel). */
	pageName: string;
	/** Cuenta de Instagram Business vinculada a la Página, o null si no tiene. */
	igBusinessAccountId: string | null;
	/** Usuario de Instagram (ej: @minegocio), o null. */
	igUsername: string | null;
	/** Habilitado por el admin para publicar. */
	enabled: boolean;
}

/**
 * Vista pública (sin tokens) de la conexión Meta de un espacio. Es lo que
 * el panel admin ve: estado, cuenta conectada y destinos disponibles.
 */
export interface MetaConnection {
	id: string;
	/** Rubro (marca) dueño de la conexión: cada rubro conecta su propia cuenta. */
	rubroId: string;
	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	espacioId: string;
	status: MetaConnectionStatus;
	/** Nombre de la cuenta de Meta conectada (para mostrar en el panel). */
	metaUserName: string | null;
	/** Permisos (scopes) otorgados en el consentimiento. */
	scopes: string[];
	/** Vencimiento del token long-lived (ISO), o null si no se conoce. */
	tokenExpiresAt: string | null;
	/** Momento de la última conexión exitosa (ISO). */
	connectedAt: string;
	/** Páginas de FB + IG vinculado descubiertos en la conexión. */
	targets: MetaTarget[];
}
