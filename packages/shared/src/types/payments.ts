/**
 * Suscripciones (débito automático a tarjeta). Cada rubro puede ofrecer uno o
 * varios planes; el visitante se suscribe desde la vitrina y el cobro recurrente
 * lo maneja un proveedor externo (por ahora Lemon Squeezy; luego Mercado Pago).
 *
 * Modelo BYO: cada espacio (negocio) conecta SU propia cuenta del proveedor, así
 * el dinero va directo a él. Las credenciales se guardan cifradas en el backend.
 */

/** Proveedor de cobro. El diseño es multi-proveedor desde el día 1. */
export enum PaymentProvider {
	/** Merchant of Record internacional (tarjetas, maneja impuestos/IVA). */
	LEMON_SQUEEZY = 'lemon_squeezy',
	/** Pagos nacionales (Argentina). Se suma más adelante. */
	MERCADO_PAGO = 'mercado_pago',
}

export const ALL_PAYMENT_PROVIDERS: PaymentProvider[] = [
	PaymentProvider.LEMON_SQUEEZY,
	PaymentProvider.MERCADO_PAGO,
];

/** Frecuencia de cobro de un plan. */
export enum SubscriptionInterval {
	MONTH = 'month',
	YEAR = 'year',
}

export const ALL_SUBSCRIPTION_INTERVALS: SubscriptionInterval[] = [
	SubscriptionInterval.MONTH,
	SubscriptionInterval.YEAR,
];

/**
 * Estado de una suscripción. Se sincroniza desde los webhooks del proveedor.
 *  - `pending`: se inició el checkout pero todavía no llegó la confirmación.
 *  - `active`: al día.
 *  - `past_due`: falló un cobro; el proveedor reintenta.
 *  - `paused`: pausada por el proveedor/usuario.
 *  - `cancelled`: dada de baja; sigue activa hasta fin del período pago.
 *  - `expired`: terminó el período y no se renovó.
 */
export enum SubscriptionStatus {
	PENDING = 'pending',
	ACTIVE = 'active',
	PAST_DUE = 'past_due',
	PAUSED = 'paused',
	CANCELLED = 'cancelled',
	EXPIRED = 'expired',
}

export const ALL_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
	SubscriptionStatus.PENDING,
	SubscriptionStatus.ACTIVE,
	SubscriptionStatus.PAST_DUE,
	SubscriptionStatus.PAUSED,
	SubscriptionStatus.CANCELLED,
	SubscriptionStatus.EXPIRED,
];

/**
 * Config del proveedor de un espacio (vista pública: SIN secretos). Sirve para
 * que el panel muestre qué hay cargado y la URL de webhook a pegar en el proveedor.
 */
export interface PaymentProviderConfigPublic {
	id: string;
	espacioId: string;
	provider: PaymentProvider;
	/** Store/collector id del negocio en el proveedor. */
	storeId: string | null;
	/** Si ya hay una API key cargada (nunca se devuelve la clave en sí). */
	hasApiKey: boolean;
	/** Si ya hay un signing secret de webhook cargado. */
	hasWebhookSecret: boolean;
	/** URL que el negocio tiene que pegar en el dashboard del proveedor. */
	webhookUrl: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Un plan de suscripción que ofrece un rubro. */
export interface SubscriptionPlan {
	id: string;
	rubroId: string;
	espacioId: string;
	nombre: string;
	descripcion: string | null;
	/** Precio de referencia mostrado en la vitrina (el cobro real lo fija el proveedor). */
	precio: number;
	moneda: string;
	intervalo: SubscriptionInterval;
	provider: PaymentProvider;
	/** Id del variant (Lemon Squeezy) / plan (Mercado Pago) al que mapea. */
	providerVariantId: string | null;
	active: boolean;
	orden: number;
	createdAt: string;
	updatedAt: string;
}

/** Un rubro suscribible con sus planes activos (respuesta del tab público). */
export interface SubscribableRubroPublic {
	rubro: {
		id: string;
		nombre: string;
		descripcion: string | null;
		imageUrl: string | null;
		logoUrl: string | null;
	};
	plans: SubscriptionPlan[];
}

/** Registro de una suscripción concreta (poblado por webhook). */
export interface Subscription {
	id: string;
	espacioId: string;
	rubroId: string;
	planId: string | null;
	provider: PaymentProvider;
	providerSubscriptionId: string | null;
	providerCustomerId: string | null;
	subscriberEmail: string;
	subscriberName: string | null;
	status: SubscriptionStatus;
	/** Fin del período pago actual (próxima renovación), o null. */
	currentPeriodEnd: string | null;
	precio: number | null;
	moneda: string | null;
	cancelledAt: string | null;
	createdAt: string;
	updatedAt: string;
}
