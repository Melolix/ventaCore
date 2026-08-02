import { BadRequestException, Injectable } from '@nestjs/common';
import type { MlFeeBreakdown, MlListingType } from '@base-template/shared';
import { MlConnectionService } from './ml-connection.service';

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
}
