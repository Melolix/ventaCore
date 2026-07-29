import { BadRequestException, Injectable } from '@nestjs/common';
import type {
	MlAttribute,
	MlCategoryPrediction,
	MlCatalogProduct,
	MlCatalogSearchResult,
} from '@base-template/shared';
import { MlConnectionService } from './ml-connection.service';

/** Tope de opciones que devolvemos por atributo (BRAND/MODEL pueden tener miles). */
const MAX_ATTR_VALUES = 60;

/** Forma cruda de un atributo de la API de ML (solo lo que usamos). */
interface RawMlAttribute {
	id: string;
	name: string;
	value_type?: string;
	tags?: Record<string, boolean>;
	values?: Array<{ id?: string; name?: string }>;
}

/**
 * Consultas al catálogo de Mercado Libre: predicción de categoría (por título)
 * y atributos de una categoría. Alimentan la carga masiva: sugerir la categoría
 * y saber qué atributos obligatorios le faltan a cada producto.
 */
@Injectable()
export class MlCatalogService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(private readonly connections: MlConnectionService) {}

	/**
	 * Busca productos en el catálogo de ML por nombre o código de barras (EAN).
	 * Si `query` son solo dígitos (8-14) se busca por identificador; si no, por texto.
	 */
	async searchCatalog(rubroId: string, espacioId: string, query: string): Promise<MlCatalogSearchResult[]> {
		const q = query.trim();
		if (!q) return [];
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const isGtin = /^\d{8,14}$/.test(q);
		const params = new URLSearchParams({ site_id: siteId, status: 'active' });
		if (isGtin) params.set('product_identifier', q);
		else params.set('q', q);

		const res = await fetch(`${this.apiHost}/products/search?${params.toString()}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as {
			results?: Array<{ id?: string; name?: string; pictures?: Array<{ url?: string }> }>;
			message?: string;
		};
		if (!res.ok) throw new BadRequestException(`Mercado Libre: ${body.message || res.statusText}`);

		return (body.results ?? [])
			.filter(r => r.id && r.name)
			.slice(0, 10)
			.map(r => ({ id: r.id!, name: r.name!, thumbnail: r.pictures?.[0]?.url ?? null }));
	}

	/**
	 * Trae un producto del catálogo con sus datos listos para autocompletar:
	 * categoría (predicha por el nombre), atributos, imagen y descripción.
	 */
	async getCatalogProduct(rubroId: string, espacioId: string, catalogProductId: string): Promise<MlCatalogProduct> {
		const id = catalogProductId.trim();
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const res = await fetch(`${this.apiHost}/products/${encodeURIComponent(id)}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as {
			id?: string;
			name?: string;
			attributes?: Array<{ id?: string; value_name?: string }>;
			pictures?: Array<{ url?: string }>;
			short_description?: { content?: string };
			message?: string;
		};
		if (!res.ok) throw new BadRequestException(`Mercado Libre: ${body.message || res.statusText}`);

		const atributos: Record<string, string> = {};
		for (const a of body.attributes ?? []) {
			if (a.id && a.value_name) atributos[a.id] = a.value_name;
		}

		// La categoría no viene en el producto de catálogo; la predecimos por el nombre.
		const preds = await this.predictCategory(rubroId, espacioId, body.name ?? '').catch(() => []);
		const cat = preds[0];

		return {
			catalogProductId: body.id ?? id,
			name: body.name ?? '',
			categoryId: cat?.categoryId ?? '',
			categoryName: cat?.categoryName ?? '',
			atributos,
			imageUrl: body.pictures?.[0]?.url ?? null,
			description: body.short_description?.content ?? null,
		};
	}

	/** Predice categorías de ML a partir del título del producto (domain_discovery). */
	async predictCategory(rubroId: string, espacioId: string, query: string): Promise<MlCategoryPrediction[]> {
		const q = query.trim();
		if (!q) return [];
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const url = `${this.apiHost}/sites/${siteId}/domain_discovery/search?limit=8&q=${encodeURIComponent(q)}`;
		const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
		const body = (await res.json().catch(() => [])) as Array<{
			domain_id?: string;
			domain_name?: string;
			category_id?: string;
			category_name?: string;
		}>;
		if (!res.ok) {
			const msg = (body as unknown as { message?: string })?.message || res.statusText;
			throw new BadRequestException(`Mercado Libre: ${msg}`);
		}

		return (Array.isArray(body) ? body : [])
			.filter(p => p.category_id)
			.map(p => ({
				categoryId: p.category_id!,
				categoryName: p.category_name ?? p.category_id!,
				domainId: p.domain_id ?? null,
				domainName: p.domain_name ?? null,
			}));
	}

	/**
	 * Atributos OBLIGATORIOS de una categoría (endpoint público de ML). Devuelve
	 * solo los `required`, con sus opciones permitidas recortadas a un tope.
	 */
	async getCategoryAttributes(categoryId: string): Promise<MlAttribute[]> {
		const id = categoryId.trim();
		if (!id) return [];

		const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(id)}/attributes`, {
			headers: { accept: 'application/json' },
		});
		const body = (await res.json().catch(() => [])) as RawMlAttribute[];
		if (!res.ok) {
			const msg = (body as unknown as { message?: string })?.message || res.statusText;
			throw new BadRequestException(`Mercado Libre: ${msg}`);
		}

		return (Array.isArray(body) ? body : [])
			.filter(a => a.tags?.required)
			.map(a => {
				const values = (a.values ?? [])
					.filter(v => v.id && v.name)
					.map(v => ({ id: v.id!, name: v.name! }));
				return {
					id: a.id,
					name: a.name,
					required: true,
					valueType: a.value_type ?? 'string',
					values: values.slice(0, MAX_ATTR_VALUES),
					valuesTruncated: values.length > MAX_ATTR_VALUES,
				};
			});
	}
}
