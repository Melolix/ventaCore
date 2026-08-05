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
	price?: number;
	available_quantity?: number;
	category_id?: string;
	permalink?: string;
	status?: string;
	catalog_product_id?: string | null;
	pictures?: Array<{ url?: string; secure_url?: string }>;
	attributes?: Array<{ id?: string; value_name?: string | null }>;
}

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

		for (const item of items) {
			// Las finalizadas/cerradas no son publicaciones vigentes: no las bajamos.
			if (item.status === 'closed') continue;
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
				source: ProductoSource.ML,
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
		const attrs = 'id,title,price,available_quantity,category_id,permalink,status,catalog_product_id,pictures,attributes';
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
