import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MlPublishResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { MlConnectionService } from './ml-connection.service';

/** Moneda por sitio de ML (los que más nos importan; fallback ARS). */
const CURRENCY_BY_SITE: Record<string, string> = {
	MLA: 'ARS',
	MLB: 'BRL',
	MLM: 'MXN',
	MLC: 'CLP',
	MCO: 'COP',
	MLU: 'UYU',
	MPE: 'PEN',
};

@Injectable()
export class MlPublishService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}
	/** Tipo de publicación. En test users no tiene costo real. */
	private get listingTypeId(): string {
		return process.env.ML_LISTING_TYPE_ID || 'bronze';
	}

	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly connections: MlConnectionService,
	) {}

	/**
	 * Publica un producto en Mercado Libre. Valida datos mínimos, arma el ítem,
	 * lo crea, le carga la descripción y guarda el id/permalink en el producto.
	 */
	async publish(rubroId: string, espacioId: string, productoId: string): Promise<MlPublishResult> {
		// El rubro debe ser del espacio; el producto, del rubro.
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');

		// Datos obligatorios para publicar.
		const faltan: string[] = [];
		if (!producto.nombre?.trim()) faltan.push('nombre');
		if (producto.precio == null) faltan.push('precio');
		if (producto.stock == null) faltan.push('stock');
		// La categoría la exigimos solo si NO se enlaza al catálogo (ahí la pone ML).
		if (!producto.mlCategoryId && !producto.mlCatalogProductId) faltan.push('categoría de ML');
		if (faltan.length) {
			throw new BadRequestException(`Faltan datos para publicar en Mercado Libre: ${faltan.join(', ')}`);
		}

		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const common = {
			price: producto.precio,
			currency_id: CURRENCY_BY_SITE[siteId] ?? 'ARS',
			available_quantity: producto.stock,
			buying_mode: 'buy_it_now',
			condition: 'new',
			listing_type_id: this.listingTypeId,
		};

		let payload: Record<string, unknown>;
		if (producto.mlCatalogProductId) {
			// Enlazado al catálogo: ML hereda atributos, título y fotos. Igual mandamos
			// la categoría si la tenemos (algunos productos de catálogo la exigen).
			payload = {
				...common,
				catalog_product_id: producto.mlCatalogProductId,
				catalog_listing: true,
				...(producto.mlCategoryId ? { category_id: producto.mlCategoryId } : {}),
			};
		} else {
			const attributes = Object.entries(producto.atributos ?? {})
				.filter(([, value]) => value && String(value).trim())
				.map(([id, value]) => ({ id, value_name: String(value).trim() }));
			// Galería completa; si no hay, la portada; si tampoco, sin fotos.
			const urls = producto.imagenes?.length ? producto.imagenes : producto.imageUrl ? [producto.imageUrl] : [];
			const pictures = urls.map(source => ({ source }));
			payload = {
				...common,
				// En el modelo actual de ML se manda `family_name` (NO `title`): ML arma
				// el título solo a partir de la familia + los atributos del ítem.
				family_name: producto.nombre.trim(),
				category_id: producto.mlCategoryId,
				...(pictures.length ? { pictures } : {}),
				...(attributes.length ? { attributes } : {}),
			};
		}

		// 1) Crear el ítem.
		const created = await this.mlPost<{ id?: string; permalink?: string }>('/items', accessToken, payload);
		const itemId = created.id;
		if (!itemId) throw new BadRequestException('Mercado Libre no devolvió el id de la publicación');

		// 2) Cargar la descripción (endpoint aparte), si hay.
		if (producto.descripcion?.trim()) {
			await this.mlPost(`/items/${itemId}/description`, accessToken, { plain_text: producto.descripcion.trim() }).catch(
				() => undefined, // la publicación ya existe; no fallamos por la descripción
			);
		}

		// 3) Guardar el resultado en el producto.
		producto.mlItemId = itemId;
		producto.mlPermalink = created.permalink ?? null;
		await this.productos.save(producto);

		return { ok: true, itemId, permalink: created.permalink };
	}

	private async mlPost<T>(path: string, accessToken: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.apiHost}${path}`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${accessToken}`,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: JSON.stringify(body),
		});
		const data = (await res.json().catch(() => ({}))) as { message?: string; cause?: unknown };
		if (!res.ok) {
			// ML devuelve el detalle en `cause`; lo incluimos para poder corregir.
			const cause = data.cause ? ` (${JSON.stringify(data.cause).slice(0, 300)})` : '';
			throw new BadRequestException(`Mercado Libre: ${data.message || res.statusText}${cause}`);
		}
		return data as T;
	}
}
