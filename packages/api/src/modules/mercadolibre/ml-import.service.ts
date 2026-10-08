import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductoSource, type MlImportResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlConnectionService } from './ml-connection.service';

/** Un ítem de ML tal como lo devuelve el multiget (solo lo que usamos). */
interface RawMlItem {
	id: string;
	title?: string;
	/** Nombre de la "familia" en el modelo actual de ML: lo comparten las variantes. */
	family_name?: string | null;
	price?: number;
	available_quantity?: number;
	category_id?: string;
	permalink?: string;
	status?: string;
	catalog_product_id?: string | null;
	pictures?: Array<{ url?: string; secure_url?: string }>;
	attributes?: RawMlAttr[];
}

/** Un atributo del ítem. `value_struct` trae número + unidad ya parseados por ML. */
interface RawMlAttr {
	id?: string;
	value_name?: string | null;
	value_struct?: { number?: number; unit?: string } | null;
}

/**
 * Ids de atributo de ML donde vive el paquete de envío que cargó el vendedor.
 * Verificado contra la cuenta real: los valores vienen como "18 cm" / "215 g".
 */
/**
 * Atributos que suelen distinguir variantes de un mismo artículo, en el orden en
 * que conviene mostrarlos ("Azul / L"). Se comparan por pertenencia al id.
 */
const VARIANT_ATTR_HINTS = ['COLOR', 'SIZE', 'TALLE', 'FLAVOR', 'SABOR', 'CAPACITY', 'VOLUME', 'VOLTAGE', 'MODEL', 'DESIGN', 'FRAGRANCE', 'LENGTH', 'WEIGHT'];
/** Atributos que cambian entre publicaciones pero NO son una variante elegible. */
const VARIANT_ATTR_IGNORE = /GTIN|EAN|UPC|SKU|MPN|PACKAGE|SELLER_|ITEM_CONDITION|WARRANTY|INVOICE|SHIPMENT|EXCLUSIVE|SYI_|IS_/;

/** Clave para comparar títulos: sin mayúsculas, acentos ni espacios repetidos. */
function normTitle(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

const PACKAGE_ATTRS = {
	alto: 'SELLER_PACKAGE_HEIGHT',
	ancho: 'SELLER_PACKAGE_WIDTH',
	largo: 'SELLER_PACKAGE_LENGTH',
	peso: 'SELLER_PACKAGE_WEIGHT',
} as const;

@Injectable()
export class MlImportService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly connections: MlConnectionService,
	) {}

	/**
	 * Baja las publicaciones de la cuenta de ML del rubro (activas Y pausadas: son
	 * publicaciones vigentes; las cerradas/finalizadas se ignoran) y las crea/
	 * actualiza como productos (dedup por `mlItemId`).
	 */
	async importActiveListings(rubroId: string, espacioId: string): Promise<MlImportResult> {
		const { accessToken, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const ids = await this.fetchItemIds(mlUserId, accessToken);
		if (!ids.length) return { imported: 0, updated: 0, total: 0 };

		const items = await this.fetchItems(ids, accessToken);
		const categoryNames = await this.fetchCategoryNames([...new Set(items.map(i => i.category_id).filter(Boolean) as string[])]);

		// Productos ya importados de este rubro, indexados por su item de ML.
		const existentes = await this.productos.find({ where: { rubroId, mlItemId: In(ids) } });
		const byItem = new Map(existentes.map(p => [p.mlItemId!, p]));

		let imported = 0;
		let updated = 0;
		const toSave: ProductoEntity[] = [];
		const vigentes = items.filter(i => i.status !== 'closed');
		const variantes = this.detectVariantes(vigentes);

		for (const item of vigentes) {
			const pics = (item.pictures ?? [])
				.map(p => (p.secure_url || p.url || '').replace(/^http:\/\//, 'https://'))
				.filter(Boolean);
			const atributos: Record<string, string> = {};
			for (const a of item.attributes ?? []) {
				if (a.id && a.value_name) atributos[a.id] = a.value_name;
			}

			const fields: Partial<ProductoEntity> = {
				nombre: item.title ?? '(sin título)',
				precio: item.price ?? null,
				stock: item.available_quantity ?? null,
				mlCategoryId: item.category_id ?? null,
				mlCategoryName: (item.category_id && categoryNames[item.category_id]) || null,
				atributos: Object.keys(atributos).length ? atributos : null,
				imageUrl: pics[0] ?? null,
				imagenes: pics,
				mlItemId: item.id,
				mlPermalink: item.permalink ?? null,
				mlStatus: item.status ?? null,
				mlCatalogProductId: item.catalog_product_id ?? null,
				// Variantes (talles, colores…): null si es una publicación suelta.
				grupo: variantes.get(item.id)?.grupo ?? null,
				variante: variantes.get(item.id)?.variante ?? null,
				source: ProductoSource.ML,
				// Dimensiones del paquete SOLO si ML las trae: no incluimos las que faltan
				// para no pisar con null lo que el usuario haya cargado a mano.
				...this.parsePackageDims(item.attributes),
			};

			const existing = byItem.get(item.id);
			if (existing) {
				Object.assign(existing, fields);
				toSave.push(existing);
				updated++;
			} else {
				toSave.push(this.productos.create({ ...fields, rubroId }));
				imported++;
			}
		}

		await this.productos.save(toSave);
		return { imported, updated, total: imported + updated };
	}

	/**
	 * Detecta qué publicaciones son VARIANTES del mismo artículo. En el modelo
	 * actual de ML cada talle/color es una publicación propia (con su stock y su
	 * precio) y todas comparten el nombre de familia; sin esto la vitrina mostraba
	 * la misma chomba en 5 cards iguales.
	 *
	 * Agrupa por nombre de familia (o título) + categoría. La etiqueta de cada
	 * variante sale de los atributos que DIFIEREN dentro del grupo (talle, color…).
	 * Devuelve solo las publicaciones que quedaron en un grupo de 2 o más.
	 */
	private detectVariantes(items: RawMlItem[]): Map<string, { grupo: string; variante: string }> {
		const grupos = new Map<string, RawMlItem[]>();
		for (const item of items) {
			const nombre = normTitle(item.family_name || item.title || '');
			if (!nombre) continue;
			const key = `ml:${item.category_id ?? ''}:${nombre}`.slice(0, 250);
			const list = grupos.get(key);
			if (list) list.push(item);
			else grupos.set(key, [item]);
		}

		const out = new Map<string, { grupo: string; variante: string }>();
		for (const [grupo, miembros] of grupos) {
			if (miembros.length < 2) continue;
			const valor = (item: RawMlItem, attrId: string) => item.attributes?.find(a => a.id === attrId)?.value_name?.trim() || '';

			// Atributos cuyo valor cambia entre las publicaciones del grupo.
			const ids = new Set(miembros.flatMap(m => (m.attributes ?? []).map(a => a.id).filter((id): id is string => !!id)));
			const distintos = [...ids].filter(id => !VARIANT_ATTR_IGNORE.test(id) && new Set(miembros.map(m => valor(m, id))).size > 1);
			// Primero los típicos (color, talle…) en su orden; si no hay ninguno, los que difieran.
			const rank = (id: string) => {
				const i = VARIANT_ATTR_HINTS.findIndex(h => id.includes(h));
				return i === -1 ? VARIANT_ATTR_HINTS.length : i;
			};
			const tipicos = distintos.filter(id => rank(id) < VARIANT_ATTR_HINTS.length).sort((a, b) => rank(a) - rank(b));
			const elegidos = (tipicos.length ? tipicos : distintos).slice(0, 2);

			const usadas = new Set<string>();
			miembros.forEach((m, i) => {
				let variante = elegidos.map(id => valor(m, id)).filter(Boolean).join(' / ');
				// Sin atributo que las distinga (o etiqueta repetida): las numeramos.
				if (!variante || usadas.has(variante)) variante = variante ? `${variante} (${i + 1})` : `Opción ${i + 1}`;
				usadas.add(variante);
				out.set(m.id, { grupo, variante: variante.slice(0, 80) });
			});
		}
		return out;
	}

	/**
	 * Saca las dimensiones del paquete de los atributos de envío del ítem
	 * (`PACKAGE_HEIGHT/WIDTH/LENGTH/WEIGHT`). Normaliza a las unidades del modelo:
	 * largo en cm (entero) y peso en gramos (entero). Devuelve SOLO las que ML trae
	 * (las ausentes no van, para no pisar lo cargado a mano). Si el vendedor nunca
	 * cargó el paquete, ML no manda estos atributos y esto queda vacío.
	 */
	private parsePackageDims(attributes: RawMlAttr[] = []): Partial<ProductoEntity> {
		const raw = (id: string): { n: number; unit: string } | null => {
			const a = attributes.find(x => x.id === id);
			if (!a) return null;
			if (a.value_struct && typeof a.value_struct.number === 'number') {
				return { n: a.value_struct.number, unit: (a.value_struct.unit || '').toLowerCase() };
			}
			// Fallback: parsear "10 cm" / "1.5 kg" del texto.
			const m = a.value_name?.trim().match(/([\d.,]+)\s*([a-zA-Z]+)?/);
			if (!m) return null;
			const n = Number(m[1].replace(',', '.'));
			return Number.isFinite(n) ? { n, unit: (m[2] || '').toLowerCase() } : null;
		};
		const toCm = (v: { n: number; unit: string } | null): number | null => {
			if (!v) return null;
			const n = v.unit === 'mm' ? v.n / 10 : v.unit === 'm' ? v.n * 100 : v.n; // cm por defecto
			return Math.round(n) || null;
		};
		const toGrams = (v: { n: number; unit: string } | null): number | null => {
			if (!v) return null;
			const n = v.unit === 'kg' ? v.n * 1000 : v.unit === 'mg' ? v.n / 1000 : v.n; // g por defecto
			return Math.round(n) || null;
		};
		const out: Partial<ProductoEntity> = {};
		const alto = toCm(raw(PACKAGE_ATTRS.alto));
		const ancho = toCm(raw(PACKAGE_ATTRS.ancho));
		const largo = toCm(raw(PACKAGE_ATTRS.largo));
		const peso = toGrams(raw(PACKAGE_ATTRS.peso));
		if (alto != null) out.alto = alto;
		if (ancho != null) out.ancho = ancho;
		if (largo != null) out.largo = largo;
		if (peso != null) out.peso = peso;
		return out;
	}

	/**
	 * Junta los ids de TODAS las publicaciones del vendedor (paginando). No filtra
	 * por estado: trae activas, pausadas y transitorias (under_review, etc.); las
	 * cerradas/finalizadas se descartan después, al ver el `status` en el detalle.
	 */
	private async fetchItemIds(mlUserId: string, token: string): Promise<string[]> {
		const ids: string[] = [];
		const limit = 50;
		for (let offset = 0; offset < 1000; offset += limit) {
			const url = `${this.apiHost}/users/${mlUserId}/items/search?limit=${limit}&offset=${offset}`;
			const body = await this.mlGet<{ results?: string[]; paging?: { total?: number } }>(url, token);
			const batch = body.results ?? [];
			ids.push(...batch);
			const total = body.paging?.total ?? ids.length;
			if (ids.length >= total || batch.length === 0) break;
		}
		return ids;
	}

	/** Trae el detalle de los ítems en tandas de 20 (multiget). */
	private async fetchItems(ids: string[], token: string): Promise<RawMlItem[]> {
		const attrs = 'id,title,family_name,price,available_quantity,category_id,permalink,status,catalog_product_id,pictures,attributes';
		const out: RawMlItem[] = [];
		for (let i = 0; i < ids.length; i += 20) {
			const chunk = ids.slice(i, i + 20);
			const url = `${this.apiHost}/items?ids=${chunk.join(',')}&attributes=${attrs}`;
			const rows = await this.mlGet<Array<{ code?: number; body?: RawMlItem }>>(url, token);
			for (const r of rows) if (r.code === 200 && r.body?.id) out.push(r.body);
		}
		return out;
	}

	/** Nombres de categoría (para mostrar el chip) por id. */
	private async fetchCategoryNames(categoryIds: string[]): Promise<Record<string, string>> {
		const map: Record<string, string> = {};
		await Promise.all(
			categoryIds.map(async id => {
				try {
					const cat = await this.mlGet<{ name?: string }>(`${this.apiHost}/categories/${id}`, '');
					if (cat.name) map[id] = cat.name;
				} catch {
					/* si falla, queda sin nombre; no es crítico */
				}
			}),
		);
		return map;
	}

	private async mlGet<T>(url: string, token: string): Promise<T> {
		const headers: Record<string, string> = { accept: 'application/json' };
		if (token) headers.authorization = `Bearer ${token}`;
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`ML ${res.status}`);
		return (await res.json()) as T;
	}
}
