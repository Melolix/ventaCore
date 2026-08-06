import { BadRequestException, Injectable } from '@nestjs/common';
import type { MlFeeBreakdown, MlListingType, MlShippingQuote } from '@base-template/shared';
import { MlConnectionService } from './ml-connection.service';

/** Dimensiones del paquete (cm) + peso (g) para cotizar envío. */
export interface PackageDims {
	alto: number;
	ancho: number;
	largo: number;
	peso: number;
}

/** Forma cruda de la respuesta de `listing_prices` de ML (solo lo que usamos). */
interface RawListingPrice {
	sale_fee_amount?: number;
	currency_id?: string;
	sale_fee_details?: {
		percentage_fee?: number;
		fixed_fee?: number;
		gross_amount?: number;
	};
}

/**
 * Calculadora de precio/comisión de Mercado Libre. Usa el endpoint oficial
 * `listing_prices`, que devuelve la comisión (porcentaje + costo fijo por unidad)
 * para un precio, categoría y tipo de publicación. Con eso el panel muestra en
 * vivo cuánto queda neto y cuánta ganancia real hay, y sugiere el precio de ML
 * para que — tras la comisión — quede una ganancia objetivo intacta.
 */
@Injectable()
export class MlPricingService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(private readonly connections: MlConnectionService) {}

	/**
	 * Comisión de ML para un precio dado (una llamada a la API). Devuelve el monto
	 * total y su desglose (porcentaje + fijo).
	 */
	async getFee(
		rubroId: string,
		espacioId: string,
		price: number,
		categoryId: string,
		listingType: MlListingType,
	): Promise<MlFeeBreakdown> {
		if (!(price > 0)) throw new BadRequestException('El precio tiene que ser mayor a 0');
		if (!categoryId.trim()) throw new BadRequestException('Falta la categoría de Mercado Libre');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const params = new URLSearchParams({
			price: String(price),
			category_id: categoryId.trim(),
			listing_type_id: listingType,
		});
		const res = await fetch(`${this.apiHost}/sites/${siteId}/listing_prices?${params.toString()}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as RawListingPrice & { message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre: ${body.message || res.statusText}`);

		// Según el tipo pedido, ML puede devolver un objeto o un array; normalizamos.
		const raw: RawListingPrice = Array.isArray(body) ? (body[0] ?? {}) : body;
		const saleFeeAmount = raw.sale_fee_amount ?? 0;
		return {
			price,
			saleFeeAmount,
			percentageFee: raw.sale_fee_details?.percentage_fee ?? 0,
			fixedFee: raw.sale_fee_details?.fixed_fee ?? 0,
			currencyId: raw.currency_id ?? 'ARS',
		};
	}

	/**
	 * Sugiere el precio de ML para que el neto (precio − comisión) alcance un
	 * objetivo (ej. costo + margen). Itera porque el costo fijo se cae en ciertos
	 * umbrales de precio: P = (neto + fijo) / (1 − %). Devuelve el desglose al
	 * precio sugerido (redondeado hacia arriba).
	 */
	async suggestPrice(
		rubroId: string,
		espacioId: string,
		netoObjetivo: number,
		categoryId: string,
		listingType: MlListingType,
	): Promise<MlFeeBreakdown> {
		if (!(netoObjetivo > 0)) throw new BadRequestException('El neto objetivo tiene que ser mayor a 0');

		// Arrancamos consultando la comisión al propio neto y ajustamos 1-2 veces.
		let price = netoObjetivo;
		let fee = await this.getFee(rubroId, espacioId, price, categoryId, listingType);
		for (let i = 0; i < 3; i++) {
			const pct = fee.percentageFee / 100;
			const next = Math.ceil((netoObjetivo + fee.fixedFee) / (1 - pct));
			if (next === price) break;
			price = next;
			fee = await this.getFee(rubroId, espacioId, price, categoryId, listingType);
		}
		return fee;
	}

	/**
	 * Cotiza el envío gratis de ML para un producto a un precio dado: cuánto paga
	 * el vendedor (`list_cost`) y si a ese precio el envío gratis es OBLIGATORIO
	 * (`mandatory_free_shipping`; por debajo del mínimo de la categoría lo paga el
	 * comprador). Requiere dimensiones + peso.
	 *
	 * Ojo: los usuarios de PRUEBA tienen este endpoint bloqueado por policy (403);
	 * se valida contra una cuenta real. El parseo es defensivo por si el shape
	 * `verbose` cambia (objeto plano vs. array de opciones).
	 */
	async getFreeShipping(
		rubroId: string,
		espacioId: string,
		dims: PackageDims,
		price: number,
		listingType: MlListingType,
	): Promise<MlShippingQuote> {
		if (!(price > 0)) throw new BadRequestException('El precio tiene que ser mayor a 0');
		if (!dims.alto || !dims.ancho || !dims.largo || !dims.peso) {
			throw new BadRequestException('Cargá alto, ancho, largo y peso del producto para cotizar el envío');
		}
		const { accessToken, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		// Formato ML: "anchoXaltoXlargo,pesoEnGramos".
		const params = new URLSearchParams({
			dimensions: `${dims.ancho}x${dims.alto}x${dims.largo},${dims.peso}`,
			item_price: String(price),
			listing_type_id: listingType,
			mode: 'me2',
			condition: 'new',
			verbose: 'true',
		});
		const res = await fetch(`${this.apiHost}/users/${mlUserId}/shipping_options/free?${params.toString()}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { message?: string };
		if (!res.ok) throw new BadRequestException(`No se pudo cotizar el envío en Mercado Libre: ${body.message || res.statusText}`);

		// Parseo defensivo: el costo puede venir plano o dentro de options/coverage.
		const opt = this.firstOption(body);
		const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
		const cost = num(opt.list_cost ?? opt.cost ?? body.list_cost);
		const mandatory = Boolean(body.mandatory_free_shipping ?? opt.mandatory_free_shipping ?? false);
		const currencyId = String(opt.currency_id ?? body.currency_id ?? 'ARS');
		return { cost, mandatory, currencyId };
	}

	/** Toma la primera "opción" de la respuesta de envío, sea plana o en array. */
	private firstOption(body: Record<string, unknown>): Record<string, unknown> {
		const arr = (body.options ?? body.coverage) as unknown;
		if (Array.isArray(arr) && arr.length) return arr[0] as Record<string, unknown>;
		return body;
	}
}
