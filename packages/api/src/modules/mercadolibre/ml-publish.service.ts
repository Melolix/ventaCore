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
	/**
	 * Tipo de publicación a usar. En desarrollo con test users, `ML_LISTING_TYPE_ID`
	 * (ej. "bronze") fuerza uno gratis para no gastar. En producción no se setea y
	 * manda el que eligió el producto (gold_special/gold_pro).
	 */
	private listingTypeFor(producto: ProductoEntity): string {
		return process.env.ML_LISTING_TYPE_ID || producto.mlListingType || 'gold_special';
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

		// Precio a publicar en ML: el de ML si está calculado; si no, el de tienda.
		const precioPublicacion = producto.precioMl ?? producto.precio;

		// Datos obligatorios para publicar.
		const faltan: string[] = [];
		if (!producto.nombre?.trim()) faltan.push('nombre');
		if (precioPublicacion == null) faltan.push('precio');
		if (producto.stock == null) faltan.push('stock');
		// La categoría la exigimos solo si NO se enlaza al catálogo (ahí la pone ML).
		if (!producto.mlCategoryId && !producto.mlCatalogProductId) faltan.push('categoría de ML');
		if (faltan.length) {
			throw new BadRequestException(`Faltan datos para publicar en Mercado Libre: ${faltan.join(', ')}`);
		}

		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const common = {
			price: precioPublicacion,
			currency_id: CURRENCY_BY_SITE[siteId] ?? 'ARS',
			available_quantity: producto.stock,
			buying_mode: 'buy_it_now',
			condition: 'new',
			listing_type_id: this.listingTypeFor(producto),
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
		const created = await this.mlPost<{ id?: string; permalink?: string; status?: string }>('/items', accessToken, payload);
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
		producto.mlStatus = created.status ?? 'active';
		await this.productos.save(producto);

		return { ok: true, itemId, permalink: created.permalink };
	}

	/**
	 * Pausa o reactiva una publicación en Mercado Libre (PUT status) y guarda el
	 * nuevo estado en el producto.
	 */
	async setStatus(rubroId: string, espacioId: string, productoId: string, status: 'active' | 'paused'): Promise<MlPublishResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		if (!producto.mlItemId) throw new BadRequestException('El producto no está publicado en Mercado Libre');

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const updated = await this.mlPut<{ id?: string; status?: string }>(`/items/${producto.mlItemId}`, accessToken, { status });
		producto.mlStatus = updated.status ?? status;
		await this.productos.save(producto);
		return { ok: true, itemId: producto.mlItemId, permalink: producto.mlPermalink ?? undefined };
	}

	/**
	 * Sincroniza una publicación YA existente en Mercado Libre con los datos del
	 * producto (precio y stock). Es lo que corre cuando el usuario cambia el precio
	 * de algo que ya está publicado: sin esto, el cambio queda solo en la app.
	 */
	async updateListing(rubroId: string, espacioId: string, productoId: string): Promise<MlPublishResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		if (!producto.mlItemId) throw new BadRequestException('El producto no está publicado en Mercado Libre');

		const precio = producto.precioMl ?? producto.precio;
		if (precio == null) throw new BadRequestException('El producto no tiene precio');

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const payload: Record<string, unknown> = { price: precio };
		if (producto.stock != null) payload.available_quantity = producto.stock;

		const updated = await this.mlPut<{ id?: string; permalink?: string }>(
			`/items/${producto.mlItemId}`,
			accessToken,
			payload,
		);

		// Imágenes: PUT aparte y best-effort (una foto que ML no pueda bajar no debe
		// romper la sincronización de precio/stock). La primera es la portada.
		const urls = producto.imagenes?.length ? producto.imagenes : producto.imageUrl ? [producto.imageUrl] : [];
		if (urls.length) {
			await this.mlPut(`/items/${producto.mlItemId}`, accessToken, {
				pictures: urls.map(source => ({ source })),
			}).catch(() => undefined);
		}

		// La descripción va por un endpoint aparte. Upsert best-effort: PUT actualiza
		// la existente; si el item todavía no tenía descripción, el PUT falla y la
		// creamos con POST. No fallamos la sync de precio/stock por la descripción.
		if (producto.descripcion?.trim()) {
			const body = { plain_text: producto.descripcion.trim() };
			await this.mlPut(`/items/${producto.mlItemId}/description`, accessToken, body).catch(() =>
				this.mlPost(`/items/${producto.mlItemId}/description`, accessToken, body).catch(() => undefined),
			);
		}

		if (updated.permalink && updated.permalink !== producto.mlPermalink) {
			producto.mlPermalink = updated.permalink;
			await this.productos.save(producto);
		}
		return { ok: true, itemId: producto.mlItemId, permalink: producto.mlPermalink ?? undefined };
	}

	private async mlPut<T>(path: string, accessToken: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.apiHost}${path}`, {
			method: 'PUT',
			headers: {
				authorization: `Bearer ${accessToken}`,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: JSON.stringify(body),
		});
		const data = (await res.json().catch(() => ({}))) as { message?: string; cause?: unknown };
		if (!res.ok) {
			const cause = data.cause ? ` (${JSON.stringify(data.cause).slice(0, 300)})` : '';
			throw new BadRequestException(`Mercado Libre: ${data.message || res.statusText}${cause}`);
		}
		return data as T;
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
