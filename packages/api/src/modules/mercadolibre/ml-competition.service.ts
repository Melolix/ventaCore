import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MlCompetencia, MlCompetidor, MlEstudio, MlEstudioEscenario, MlListingType } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { MlConnectionService } from './ml-connection.service';
import { MlPricingService } from './ml-pricing.service';
import { MATCH_MIN, isSimilar, matchScore, sharesWord, similarQuery, type CatalogCandidate } from './ml-match';

/** Cuánto vale una consulta guardada: los precios de la competencia no cambian al minuto. */
const CACHE_MS = 30 * 60 * 1000;
/** Tope de competidores que devolvemos (los más baratos). */
const MAX_COMPETIDORES = 5;
/** Tope de fichas del catálogo que se consultan por producto. */
const MAX_FICHAS = 4;
/** Fichas candidatas que se revisan cuando se busca por nombre. */
const MAX_CANDIDATAS = 3;
/** Fichas de productos parecidos (otras marcas) que se juntan como referencia. */
const MAX_SIMILARES = 5;
/** Dominio de ML por sitio, para armar el link a la ficha del producto. */
const SITE_HOST: Record<string, string> = {
	MLA: 'www.mercadolibre.com.ar',
	MLB: 'www.mercadolivre.com.br',
	MLM: 'www.mercadolibre.com.mx',
	MLC: 'www.mercadolibre.cl',
	MCO: 'www.mercadolibre.com.co',
	MLU: 'www.mercadolibre.com.uy',
	MPE: 'www.mercadolibre.com.pe',
};

/** Oferta de un vendedor sobre un producto de catálogo (solo lo que usamos). */
interface RawOffer {
	item_id?: string;
	seller_id?: number | string;
	price?: number;
	condition?: string;
	category_id?: string;
	official_store_id?: number | null;
	shipping?: { free_shipping?: boolean; logistic_type?: string };
}

/** Publicación propia (solo lo que usamos). */
interface RawItem {
	price?: number;
	catalog_product_id?: string | null;
	catalog_listing?: boolean;
}

/** Lo que se sabe del mercado de un producto: su ficha y quiénes más lo venden. */
interface Mercado {
	via: 'publicacion' | 'ean' | 'nombre' | 'similares' | null;
	/** Con `via: 'similares'`: los productos parecidos que se tomaron de referencia. */
	similares: string[];
	item: RawItem | null;
	catalogProductId: string | null;
	catalogName: string | null;
	permalink: string | null;
	/** Categoría de ML de esas ofertas (sirve para la comisión si el producto no tiene una). */
	categoryId: string | null;
	/** Ofertas de OTROS vendedores, nuevas, de menor a mayor precio. */
	ofertas: RawOffer[];
	siteId: string;
	accessToken: string;
}

/**
 * Precios de la competencia en Mercado Libre y estudio de mercado.
 *
 * Solo compara contra EL MISMO producto. Usa el catálogo de ML, donde todos los
 * vendedores de un artículo (la misma pinza, la misma yerba) cuelgan de una misma
 * ficha. A esa ficha se llega por la publicación, por el enlace que ya tenga el
 * producto, por su código de barras o — solo en el estudio — por el nombre, con
 * una regla estricta (ver `ml-match.ts`). El buscador general de ML está cerrado
 * para las apps, así que no hay comparación por parecido de título.
 */
@Injectable()
export class MlCompetitionService {
	private readonly cache = new Map<string, { at: number; data: unknown }>();

	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly connections: MlConnectionService,
		private readonly pricing: MlPricingService,
	) {}

	private async get<T>(path: string, accessToken: string): Promise<T | null> {
		const res = await fetch(`${this.apiHost}${path}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		}).catch(() => null);
		// Un 404 acá es normal ("la ficha no tiene ofertas"): se trata como sin dato.
		if (!res?.ok) return null;
		return (await res.json().catch(() => null)) as T | null;
	}

	private async load(rubroId: string, espacioId: string, productoId: string): Promise<ProductoEntity> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		return producto;
	}

	/** Guarda el resultado un rato: una lista entera son muchos pedidos a ML. */
	private async cached<T>(key: string, refresh: boolean, build: () => Promise<T>): Promise<T> {
		const hit = this.cache.get(key);
		if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
		const data = await build();
		this.cache.set(key, { at: Date.now(), data });
		return data;
	}

	/**
	 * Busca la ficha del producto en el catálogo y las ofertas de los demás.
	 * `porNombre` habilita el último recurso: buscar por el nombre.
	 */
	private async mercado(producto: ProductoEntity, rubroId: string, espacioId: string, porNombre: boolean): Promise<Mercado> {
		const { accessToken, siteId, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const out: Mercado = { via: null, similares: [], item: null, catalogProductId: null, catalogName: null, permalink: null, categoryId: null, ofertas: [], siteId, accessToken };

		out.item = producto.mlItemId
			? await this.get<RawItem>(`/items/${producto.mlItemId}?attributes=id,price,catalog_product_id,catalog_listing`, accessToken)
			: null;

		// Puede haber más de una ficha para el mismo artículo (ML las duplica): la de
		// la publicación y las que tengan su código de barras. Se juntan las ofertas.
		const fichas: string[] = [];
		const propia = out.item?.catalog_product_id || producto.mlCatalogProductId || null;
		if (propia) {
			fichas.push(propia);
			out.via = 'publicacion';
		}
		const gtin = producto.gtin?.trim();
		if (gtin && /^\d{8,14}$/.test(gtin)) {
			const params = new URLSearchParams({ site_id: siteId, status: 'active', product_identifier: gtin });
			const found = await this.get<{ results?: Array<{ id?: string }> }>(`/products/search?${params.toString()}`, accessToken);
			for (const r of found?.results ?? []) {
				if (r.id && !fichas.includes(r.id) && fichas.length < MAX_FICHAS) fichas.push(r.id);
			}
			if (!out.via && fichas.length) out.via = 'ean';
		}

		const ofertasDe = (id: string) =>
			this.get<{ results?: RawOffer[] }>(`/products/${id}/items?limit=50`, accessToken).then(r => ({ id, ofertas: r?.results ?? [] }));
		let porFicha = await Promise.all(fichas.map(ofertasDe));
		let nombre: string | null = null;

		// Último recurso: buscar la ficha por el nombre. Solo si lo anterior no
		// encontró a nadie vendiéndolo, y solo si el parecido es claro.
		if (porNombre && !porFicha.some(f => f.ofertas.length) && producto.nombre?.trim()) {
			const params = new URLSearchParams({ site_id: siteId, status: 'active', limit: '10', q: producto.nombre.trim() });
			const found = await this.get<{ results?: CatalogCandidate[] }>(`/products/search?${params.toString()}`, accessToken);
			const candidatas = (found?.results ?? [])
				.filter(c => c.id && !c.children_ids?.length)
				.map(c => ({ c, score: matchScore(producto.nombre, c) }))
				.filter(x => x.score >= MATCH_MIN)
				.sort((a, b) => b.score - a.score)
				.slice(0, MAX_CANDIDATAS);
			for (const { c } of candidatas) {
				const f = await ofertasDe(c.id as string);
				if (!f.ofertas.length) continue;
				porFicha = [f];
				nombre = c.name ?? null;
				out.via = 'nombre';
				break;
			}

			// Si el producto exacto no está en ML (marcas chicas, ferretería genérica),
			// queda una referencia: lo mismo de otras marcas, en la misma medida. No es
			// el mismo producto y así se muestra.
			if (!porFicha.some(f => f.ofertas.length)) {
				const marca = String(producto.atributos?.BRAND ?? '');
				const q = similarQuery(producto.nombre, marca);
				let pool = found?.results ?? [];
				if (q && q !== producto.nombre.trim().toLowerCase()) {
					const p2 = new URLSearchParams({ site_id: siteId, status: 'active', limit: '15', q });
					const more = await this.get<{ results?: CatalogCandidate[] }>(`/products/search?${p2.toString()}`, accessToken);
					pool = [...pool, ...(more?.results ?? [])];
				}
				const vistos = new Set<string>();
				const parecidas = pool.filter(c => {
					if (!c.id || vistos.has(c.id) || c.children_ids?.length) return false;
					vistos.add(c.id);
					return isSimilar(producto.nombre, c, marca);
				});
				const conOfertas: Array<{ id: string; ofertas: RawOffer[] }> = [];
				for (const c of parecidas) {
					if (conOfertas.length >= MAX_SIMILARES) break;
					const f = await ofertasDe(c.id as string);
					if (!f.ofertas.length) continue;
					conOfertas.push(f);
					out.similares.push(c.name ?? '');
				}
				if (conOfertas.length) {
					porFicha = conOfertas;
					nombre = out.similares[0] || null;
					out.via = 'similares';
				}
			}
		}
		if (!porFicha.length) {
			out.via = null;
			return out;
		}

		// La ficha que se muestra: la primera con ofertas (si ninguna tiene, la propia).
		const principal = porFicha.find(f => f.ofertas.length)?.id ?? porFicha[0].id;
		out.catalogProductId = principal;
		out.catalogName = nombre ?? (await this.get<{ name?: string }>(`/products/${principal}?attributes=id,name`, accessToken))?.name ?? null;
		out.permalink = SITE_HOST[siteId] ? `https://${SITE_HOST[siteId]}/p/${principal}` : null;

		const vistas = new Set<string>();
		out.ofertas = porFicha
			.flatMap(f => f.ofertas)
			.filter(o => {
				if (!o.item_id || vistas.has(o.item_id)) return false;
				vistas.add(o.item_id);
				return o.price != null && String(o.seller_id ?? '') !== String(mlUserId) && o.item_id !== producto.mlItemId && (o.condition ?? 'new') === 'new';
			})
			.sort((a, b) => (a.price as number) - (b.price as number));
		out.categoryId = out.ofertas.find(o => o.category_id)?.category_id ?? null;
		return out;
	}

	private static competidores(ofertas: RawOffer[]): MlCompetidor[] {
		return ofertas.slice(0, MAX_COMPETIDORES).map(o => ({
			itemId: o.item_id ?? null,
			precio: o.price as number,
			envioGratis: !!o.shipping?.free_shipping,
			full: o.shipping?.logistic_type === 'fulfillment',
			tiendaOficial: o.official_store_id != null,
		}));
	}

	private static vendedores(ofertas: RawOffer[]): number {
		return new Set(ofertas.map(o => String(o.seller_id ?? o.item_id))).size;
	}

	// ── Competencia de un producto (semáforo de la pantalla de publicaciones) ──

	async forProducto(rubroId: string, espacioId: string, productoId: string, refresh = false): Promise<MlCompetencia> {
		const producto = await this.load(rubroId, espacioId, productoId);
		// El precio entra en la clave: si lo cambian, la comparación guardada ya no sirve.
		const key = `c:${producto.id}:${producto.precioMl ?? producto.precio ?? ''}:${producto.mlItemId ?? ''}:${producto.gtin ?? ''}`;
		return this.cached(key, refresh, () => this.compare(producto, rubroId, espacioId));
	}

	private async compare(producto: ProductoEntity, rubroId: string, espacioId: string): Promise<MlCompetencia> {
		const m = await this.mercado(producto, rubroId, espacioId, false);
		const base: MlCompetencia = {
			estado: 'sin_datos',
			fuente: m.via === 'publicacion' ? 'catalogo' : m.via === 'ean' ? 'ean' : null,
			miPrecio: m.item?.price ?? producto.precioMl ?? producto.precio,
			precioParaGanar: null,
			mejorPrecio: m.ofertas[0]?.price ?? null,
			vendedores: MlCompetitionService.vendedores(m.ofertas),
			competidores: MlCompetitionService.competidores(m.ofertas),
			catalogProductId: m.catalogProductId,
			catalogName: m.catalogName,
			permalink: m.permalink,
			actualizado: new Date().toISOString(),
		};
		if (!m.catalogProductId) return base;

		// Publicación de catálogo: ML dice si ganás y a qué precio ganarías (tiene
		// en cuenta envío, cuotas y reputación, no solo el precio).
		if (producto.mlItemId && m.item?.catalog_listing) {
			const ptw = await this.get<{ status?: string; price_to_win?: number | null; current_price?: number }>(
				`/items/${producto.mlItemId}/price_to_win?siteId=${m.siteId}&version=v2`,
				m.accessToken,
			);
			if (ptw?.status === 'winning' || ptw?.status === 'sharing_first_place' || ptw?.status === 'competing') {
				base.estado = ptw.status === 'winning' ? 'ganando' : ptw.status === 'sharing_first_place' ? 'compartiendo' : 'perdiendo';
				base.precioParaGanar = ptw.price_to_win ?? null;
				if (ptw.current_price != null) base.miPrecio = ptw.current_price;
				return base;
			}
		}

		// Si no, la comparación es solo por precio contra el más barato.
		if (!base.competidores.length) base.estado = 'sin_competencia';
		else if (base.miPrecio == null) base.estado = 'sin_datos';
		else base.estado = base.miPrecio <= (base.mejorPrecio as number) ? 'en_precio' : 'caro';
		return base;
	}

	// ── Estudio de mercado: ¿conviene vender este producto con este costo? ──

	/**
	 * A cuánto se vende el producto en ML y cuánto quedaría de ganancia, con el
	 * costo cargado, vendiéndolo al precio del más barato (comisión y envío
	 * descontados). No decide si conviene: eso depende del margen que busque cada uno.
	 */
	async estudio(rubroId: string, espacioId: string, productoId: string, refresh = false): Promise<MlEstudio> {
		const producto = await this.load(rubroId, espacioId, productoId);
		const key = `e:${producto.id}:${producto.precioCosto ?? ''}:${producto.nombre}:${producto.gtin ?? ''}:${producto.mlItemId ?? ''}:${producto.mlCategoryId ?? ''}`;
		return this.cached(key, refresh, async () => {
			const m = await this.mercado(producto, rubroId, espacioId, true);
			const precios = m.ofertas.map(o => o.price as number);
			const out: MlEstudio = {
				via: m.ofertas.length ? m.via : null,
				catalogProductId: m.catalogProductId,
				catalogName: m.catalogName,
				similares: m.via === 'similares' ? m.similares : [],
				// Un código de barras mal cargado lleva a otro producto: si los nombres no
				// tienen nada en común, no se confía en esa comparación.
				noCoincide: m.via === 'ean' && !!m.catalogName && !sharesWord(producto.nombre, m.catalogName),
				permalink: m.permalink,
				vendedores: MlCompetitionService.vendedores(m.ofertas),
				precioMin: precios[0] ?? null,
				precioMediana: precios.length ? precios[Math.floor((precios.length - 1) / 2)] : null,
				competidores: MlCompetitionService.competidores(m.ofertas),
				costo: producto.precioCosto,
				alMin: null,
				alMedio: null,
				envioSinMedidas: !(producto.alto && producto.ancho && producto.largo && producto.peso),
				actualizado: new Date().toISOString(),
			};
			const categoryId = producto.mlCategoryId || m.categoryId;
			if (out.precioMin == null || !categoryId) return out;
			const listingType = (producto.mlListingType || 'gold_special') as MlListingType;

			/** Qué queda vendiendo a un precio: comisión real de ML y, si hay medidas, el envío. */
			const escenario = async (precio: number): Promise<MlEstudioEscenario | null> => {
				const fee = await this.pricing.getFee(rubroId, espacioId, precio, categoryId, listingType).catch(() => null);
				if (!fee) return null;
				let envio = 0;
				if (!out.envioSinMedidas) {
					const dims = { alto: producto.alto as number, ancho: producto.ancho as number, largo: producto.largo as number, peso: producto.peso as number };
					const quote = await this.pricing.getFreeShipping(rubroId, espacioId, dims, precio, listingType).catch(() => null);
					if (quote) envio = quote.mandatory ? quote.cost : 0;
					else out.envioSinMedidas = true;
				}
				const costo = producto.precioCosto != null && producto.precioCosto > 0 ? producto.precioCosto : null;
				const ganancia = costo != null ? Math.round((precio - fee.saleFeeAmount - envio - costo) * 100) / 100 : null;
				return {
					precio,
					comision: fee.saleFeeAmount,
					comisionPct: fee.percentageFee,
					envio,
					ganancia,
					gananciaPct: ganancia != null && costo != null ? Math.round((ganancia / costo) * 100) : null,
				};
			};
			out.alMin = await escenario(out.precioMin);
			// Con un solo precio (o todos iguales) el del medio es el mismo: no se consulta dos veces.
			out.alMedio = out.precioMediana != null && out.precioMediana !== out.precioMin ? await escenario(out.precioMediana) : out.alMin;
			return out;
		});
	}
}
