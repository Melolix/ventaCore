import { PaymentProvider, SubscriptionStatus } from '@base-template/shared';

/** Datos para crear un checkout hosteado en el proveedor. */
export interface CreateCheckoutInput {
	/** API key (descifrada) de la cuenta del negocio. */
	apiKey: string;
	/** Store/collector id del negocio en el proveedor. */
	storeId: string | null;
	/** Variant (LS) / plan (MP) al que se suscribe. */
	variantId: string;
	email: string;
	name?: string | null;
	/** A dónde vuelve el visitante tras pagar (thank-you page), o null. */
	returnUrl: string | null;
	/**
	 * Datos que el proveedor devuelve tal cual en el webhook (para mapear la
	 * suscripción a nuestro espacio/rubro/plan). Claves y valores string.
	 */
	custom: Record<string, string>;
}

export interface CreateCheckoutOutput {
	/** URL hosteada a la que redirigimos al visitante para que cargue la tarjeta. */
	checkoutUrl: string;
	providerCheckoutId: string | null;
}

/** Datos custom que embebemos en el checkout y recuperamos en el webhook. */
export interface CheckoutCustomData {
	espacioId?: string;
	rubroId?: string;
	planId?: string;
	email?: string;
}

/**
 * Evento de suscripción del proveedor, ya normalizado a nuestro modelo. Cada
 * proveedor traduce su payload a esta forma común.
 */
export interface NormalizedSubscriptionEvent {
	/** Id único del evento para deduplicar (idempotencia). */
	providerEventId: string;
	/** Nombre crudo del evento del proveedor (ej. `subscription_created`). */
	eventType: string;
	providerSubscriptionId: string | null;
	providerCustomerId: string | null;
	/** Estado normalizado, o null si el evento no lo cambia. */
	status: SubscriptionStatus | null;
	subscriberEmail: string | null;
	subscriberName: string | null;
	currentPeriodEnd: Date | null;
	cancelledAt: Date | null;
	custom: CheckoutCustomData;
	/** Payload crudo (para auditoría). */
	raw: Record<string, unknown>;
}

/**
 * Contrato común de un proveedor de cobro. Sumar Mercado Pago = implementar esta
 * interfaz y registrarla; el resto del flujo no cambia.
 */
export interface PaymentProviderService {
	readonly provider: PaymentProvider;

	/** Crea un checkout hosteado y devuelve su URL. */
	createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput>;

	/** Verifica la firma del webhook contra el secret del negocio. */
	verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean;

	/** Traduce el payload del webhook a nuestro modelo normalizado. */
	parseWebhookEvent(rawBody: Buffer): NormalizedSubscriptionEvent | null;

	/** Da de baja una suscripción en el proveedor (baja al fin del período pago). */
	cancelSubscription(apiKey: string, providerSubscriptionId: string): Promise<void>;
}

/** Token de inyección para la lista de proveedores registrados. */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
