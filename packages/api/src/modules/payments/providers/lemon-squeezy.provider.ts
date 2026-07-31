import { BadGatewayException, Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PaymentProvider, SubscriptionStatus } from '@base-template/shared';
import {
	CreateCheckoutInput,
	CreateCheckoutOutput,
	NormalizedSubscriptionEvent,
	PaymentProviderService,
} from './payment-provider.interface';

const LS_API = 'https://api.lemonsqueezy.com/v1';
const LS_HEADERS = {
	Accept: 'application/vnd.api+json',
	'Content-Type': 'application/vnd.api+json',
};

/** Mapea el `status` de una suscripción de Lemon Squeezy a nuestro enum. */
function mapStatus(lsStatus: string | undefined): SubscriptionStatus | null {
	switch (lsStatus) {
		case 'on_trial':
		case 'active':
			return SubscriptionStatus.ACTIVE;
		case 'paused':
			return SubscriptionStatus.PAUSED;
		case 'past_due':
		case 'unpaid':
			return SubscriptionStatus.PAST_DUE;
		case 'cancelled':
			return SubscriptionStatus.CANCELLED;
		case 'expired':
			return SubscriptionStatus.EXPIRED;
		default:
			return null;
	}
}

function toDate(value: unknown): Date | null {
	if (typeof value !== 'string' || !value) return null;
	const d = new Date(value);
	return isNaN(d.getTime()) ? null : d;
}

/**
 * Proveedor Lemon Squeezy (Merchant of Record). El checkout es hosteado: la
 * tarjeta se carga en la página de LS, nunca en nuestro servidor. Los webhooks
 * se firman con HMAC-SHA256 usando el signing secret que el negocio configura.
 *
 * Docs: https://docs.lemonsqueezy.com/api
 */
@Injectable()
export class LemonSqueezyProvider implements PaymentProviderService {
	readonly provider = PaymentProvider.LEMON_SQUEEZY;

	async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput> {
		if (!input.storeId) {
			throw new BadGatewayException('Falta el Store ID de Lemon Squeezy en la configuración del negocio');
		}

		const body = {
			data: {
				type: 'checkouts',
				attributes: {
					checkout_data: {
						email: input.email,
						name: input.name || undefined,
						// LS exige que los valores custom sean strings; los devuelve en meta.custom_data.
						custom: input.custom,
					},
					product_options: input.returnUrl ? { redirect_url: input.returnUrl } : undefined,
				},
				relationships: {
					store: { data: { type: 'stores', id: String(input.storeId) } },
					variant: { data: { type: 'variants', id: String(input.variantId) } },
				},
			},
		};

		const res = await fetch(`${LS_API}/checkouts`, {
			method: 'POST',
			headers: { ...LS_HEADERS, Authorization: `Bearer ${input.apiKey}` },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new BadGatewayException(`Lemon Squeezy rechazó el checkout (${res.status}): ${detail.slice(0, 200)}`);
		}

		const json = (await res.json()) as { data?: { id?: string; attributes?: { url?: string } } };
		const url = json.data?.attributes?.url;
		if (!url) throw new BadGatewayException('Lemon Squeezy no devolvió la URL del checkout');

		return { checkoutUrl: url, providerCheckoutId: json.data?.id ?? null };
	}

	verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean {
		const header = headers['x-signature'] ?? headers['X-Signature'];
		const signature = Array.isArray(header) ? header[0] : header;
		if (!signature) return false;

		const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
		const a = Buffer.from(digest, 'utf8');
		const b = Buffer.from(signature, 'utf8');
		return a.length === b.length && timingSafeEqual(a, b);
	}

	parseWebhookEvent(rawBody: Buffer): NormalizedSubscriptionEvent | null {
		let payload: LsWebhookPayload;
		try {
			payload = JSON.parse(rawBody.toString('utf8')) as LsWebhookPayload;
		} catch {
			return null;
		}

		const eventType = payload.meta?.event_name;
		if (!eventType) return null;

		const attrs = payload.data?.attributes ?? {};
		const custom = payload.meta?.custom_data ?? {};
		const status = mapStatus(attrs.status);

		return {
			// LS no manda un id de evento único; hasheamos el body → dos entregas
			// idénticas (reintentos) deduplican; eventos distintos difieren.
			providerEventId: createHash('sha256').update(rawBody).digest('hex'),
			eventType,
			providerSubscriptionId: payload.data?.id ?? null,
			providerCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
			status,
			subscriberEmail: attrs.user_email ?? custom.email ?? null,
			subscriberName: attrs.user_name ?? null,
			currentPeriodEnd: toDate(attrs.renews_at),
			cancelledAt: attrs.cancelled ? toDate(attrs.ends_at) : null,
			custom: {
				espacioId: custom.espacio_id,
				rubroId: custom.rubro_id,
				planId: custom.plan_id,
				email: custom.email,
			},
			raw: payload as unknown as Record<string, unknown>,
		};
	}

	async cancelSubscription(apiKey: string, providerSubscriptionId: string): Promise<void> {
		const res = await fetch(`${LS_API}/subscriptions/${providerSubscriptionId}`, {
			method: 'DELETE',
			headers: { ...LS_HEADERS, Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok && res.status !== 404) {
			const detail = await res.text().catch(() => '');
			throw new BadGatewayException(`Lemon Squeezy no pudo cancelar (${res.status}): ${detail.slice(0, 200)}`);
		}
	}
}

/** Forma parcial del payload de webhook de Lemon Squeezy que consumimos. */
interface LsWebhookPayload {
	meta?: {
		event_name?: string;
		custom_data?: {
			espacio_id?: string;
			rubro_id?: string;
			plan_id?: string;
			email?: string;
		};
	};
	data?: {
		id?: string;
		attributes?: {
			status?: string;
			customer_id?: number | string;
			user_email?: string;
			user_name?: string;
			renews_at?: string;
			ends_at?: string;
			cancelled?: boolean;
		};
	};
}
