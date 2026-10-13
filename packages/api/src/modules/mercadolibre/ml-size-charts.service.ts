import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
	MlManagedSizeChart,
	MlManagedSizeChartColumn,
	MlSizeChartCellValue,
	MlSizeChartRowInput,
} from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlConnectionService } from './ml-connection.service';
import { MlCatalogService, type RawChartError } from './ml-catalog.service';

/** Valor crudo de una celda de guía (GET /catalog/charts/:id). */
type RawValue = { id?: string; name?: string; struct?: { number?: number; unit?: string } };
type RawAttr = { id?: string; name?: string; values?: RawValue[] };

/** Guía cruda tal como la devuelve ML. */
interface RawChart {
	id?: string | number;
	names?: Record<string, string>;
	type?: string;
	seller_id?: number | string;
	domain_id?: string;
	main_attribute_id?: string;
	chart_status?: string;
	attributes?: RawAttr[];
	rows?: Array<{ id?: string; attributes?: RawAttr[] }>;
}

/**
 * Gestión de las guías de talles propias del vendedor (las SPECIFIC): listar,
 * renombrar, sumar talles, corregir medidas y borrar. ML no deja cambiar el talle
 * de una fila, quitar filas ni cambiar género / marca / tipo de talle.
 */
@Injectable()
export class MlSizeChartsService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly connections: MlConnectionService,
		private readonly catalog: MlCatalogService,
	) {}

	/**
	 * Guías propias del vendedor relacionadas con los productos del rubro. ML no
	 * tiene un "listar todas": busca por tipo de producto + género + marca. Así que
	 * juntamos esas combinaciones de los productos (más las guías que ya tienen
	 * elegidas) y traemos el detalle de cada una.
	 */
	async listMine(rubroId: string, espacioId: string): Promise<MlManagedSizeChart[]> {
		const { accessToken, mlUserId, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const productos = await this.productos.find({ where: { rubroId } });

		const ids = new Set<string>();
		const combos = new Map<string, { categoryId: string; gender: string; brand: string }>();
		for (const p of productos) {
			const a = p.atributos ?? {};
			const grid = String(a.SIZE_GRID_ID ?? '').trim();
			if (grid) ids.add(grid);
			const gender = String(a.GENDER ?? '').trim();
			const brand = String(a.BRAND ?? '').trim();
			if (p.mlCategoryId && gender && brand) combos.set(`${p.mlCategoryId}|${gender}|${brand}`, { categoryId: p.mlCategoryId, gender, brand });
		}

		// Solo las categorías de moda (las que piden guía) y una vez cada una.
		const requires = new Map<string, boolean>();
		for (const { categoryId } of combos.values()) {
			if (!requires.has(categoryId)) requires.set(categoryId, await this.catalog.requiresSizeGrid(categoryId));
		}
		for (const c of combos.values()) {
			if (!requires.get(c.categoryId)) continue;
			const { short } = await this.catalog.categoryDomain(c.categoryId).catch(() => ({ short: '' }));
			if (!short) continue;
			const res = await fetch(`${this.apiHost}/catalog/charts/search?limit=50`, {
				method: 'POST',
				headers: this.headers(accessToken),
				body: JSON.stringify({
					domain_id: short,
					site_id: siteId,
					seller_id: Number(mlUserId),
					type: 'SPECIFIC',
					attributes: [
						{ id: 'GENDER', values: [{ name: c.gender }] },
						{ id: 'BRAND', values: [{ name: c.brand }] },
					],
				}),
			});
			const body = (await res.json().catch(() => ({}))) as { charts?: Array<{ id?: string | number }> };
			if (res.ok) for (const ch of body.charts ?? []) if (ch.id) ids.add(String(ch.id));
		}

		const raws = await Promise.all([...ids].map(id => this.fetchChart(accessToken, id).catch(() => null)));
		return raws
			.filter((c): c is RawChart => !!c && c.type === 'SPECIFIC' && String(c.seller_id ?? '') === String(mlUserId))
			.map(c => this.toManaged(c, siteId, productos))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** Cambia el nombre de la guía (lo único general que ML deja editar). */
	async rename(rubroId: string, espacioId: string, chartId: string, name: string): Promise<MlManagedSizeChart> {
		const clean = name
			.replace(/[^\p{L}\p{N} ]+/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60)
			.trim();
		if (!clean) throw new BadRequestException('El nombre de la guía tiene que tener letras o números');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		await this.send(accessToken, 'PUT', `/catalog/charts/${encodeURIComponent(chartId)}`, { names: { [siteId]: clean } }, 'aceptó el nombre');
		return this.reload(rubroId, accessToken, siteId, chartId);
	}

	/** Suma un talle (fila) a la guía. */
	async addRow(rubroId: string, espacioId: string, chartId: string, input: MlSizeChartRowInput): Promise<MlManagedSizeChart> {
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const attributes = input.attributes.filter(c => c.values.length).map(c => this.catalog.toMlCell(c.id, c.values));
		if (!attributes.length) throw new BadRequestException('Completá el talle nuevo');
		await this.send(accessToken, 'POST', `/catalog/charts/${encodeURIComponent(chartId)}/rows`, { attributes }, 'aceptó el talle nuevo');
		return this.reload(rubroId, accessToken, siteId, chartId);
	}

	/** Corrige las medidas de un talle (el talle en sí no se puede cambiar). */
	async updateRow(rubroId: string, espacioId: string, chartId: string, rowId: string, input: MlSizeChartRowInput): Promise<MlManagedSizeChart> {
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const attributes = input.attributes.filter(c => c.values.length).map(c => this.catalog.toMlCell(c.id, c.values));
		if (!attributes.length) return this.reload(rubroId, accessToken, siteId, chartId);
		// El id de la fila es "<guía>:<n>"; la ruta de ML usa solo el número.
		const n = rowId.includes(':') ? rowId.split(':').pop()! : rowId;
		await this.send(accessToken, 'PUT', `/catalog/charts/${encodeURIComponent(chartId)}/rows/${encodeURIComponent(n)}`, { attributes }, 'aceptó las medidas');
		return this.reload(rubroId, accessToken, siteId, chartId);
	}

	/**
	 * Pide borrar la guía. ML no la borra al instante: la marca inactiva y la
	 * elimina en 24 h si confirma que ninguna publicación la usa. Si un producto
	 * de VentaCore la tiene elegida, avisamos antes (ML la rechazaría igual).
	 */
	async remove(rubroId: string, espacioId: string, chartId: string): Promise<{ message: string }> {
		const productos = await this.productos.find({ where: { rubroId } });
		const usan = [...new Set(productos.filter(p => String(p.atributos?.SIZE_GRID_ID ?? '').trim() === chartId).map(p => p.nombre))];
		if (usan.length) {
			throw new BadRequestException(
				`No se puede borrar: la usan ${usan.length === 1 ? 'este producto' : 'estos productos'}: ${usan.slice(0, 5).join(', ')}${usan.length > 5 ? '…' : ''}. Elegiles otra guía primero.`,
			);
		}
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		await this.send(accessToken, 'DELETE', `/catalog/charts/${encodeURIComponent(chartId)}`, undefined, 'permitió borrar la guía');
		return { message: 'Pedimos borrar la guía. Mercado Libre la elimina en 24 horas si ninguna publicación la usa.' };
	}

	private headers(accessToken: string): Record<string, string> {
		return { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` };
	}

	private async fetchChart(accessToken: string, chartId: string): Promise<RawChart> {
		const res = await fetch(`${this.apiHost}/catalog/charts/${encodeURIComponent(chartId)}`, { headers: this.headers(accessToken) });
		const body = (await res.json().catch(() => ({}))) as RawChart & { message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre: no se pudo leer la guía de talles (${body.message || res.statusText})`);
		return body;
	}

	private async send(accessToken: string, method: string, path: string, body: unknown, action: string): Promise<void> {
		const res = await fetch(`${this.apiHost}${path}`, {
			method,
			headers: this.headers(accessToken),
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});
		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as RawChartError;
			throw this.catalog.chartError(data, res.statusText, action);
		}
	}

	private async reload(rubroId: string, accessToken: string, siteId: string, chartId: string): Promise<MlManagedSizeChart> {
		const [raw, productos] = await Promise.all([this.fetchChart(accessToken, chartId), this.productos.find({ where: { rubroId } })]);
		return this.toManaged(raw, siteId, productos);
	}

	/** Guía cruda → guía para gestionar (filas con sus valores, columnas y quién la usa). */
	private toManaged(raw: RawChart, siteId: string, productos: ProductoEntity[]): MlManagedSizeChart {
		const id = String(raw.id ?? '');
		const mainId = raw.main_attribute_id ?? 'SIZE';
		const valueOf = (v?: RawValue): MlSizeChartCellValue | null => {
			if (!v?.name && v?.struct?.number == null) return null;
			const n = v.struct?.number;
			return { name: v.name ?? `${n} ${v.struct?.unit ?? ''}`.trim(), ...(n != null ? { number: n, unit: v.struct?.unit ?? '' } : {}) };
		};

		const columns = new Map<string, MlManagedSizeChartColumn>();
		let mainName = mainId;
		let mainUnit: string | null = null;
		const rows = (raw.rows ?? [])
			.filter(r => r.id)
			.map(r => {
				const values: Record<string, MlSizeChartCellValue> = {};
				for (const a of r.attributes ?? []) {
					if (!a.id) continue;
					const v = valueOf(a.values?.[0]);
					if (!v) continue;
					values[a.id] = v;
					if (a.id === mainId) {
						mainName = a.name ?? mainId;
						if (v.unit) mainUnit = v.unit;
						continue;
					}
					// SIZE lo calcula ML a partir del talle principal: no es una columna para editar.
					if (a.id === 'SIZE') continue;
					const isList = (a.values ?? []).some(x => x.id);
					const prev = columns.get(a.id);
					columns.set(a.id, {
						id: a.id,
						name: a.name ?? a.id,
						unit: prev?.unit ?? v.unit ?? null,
						editable: (prev?.editable ?? true) && !isList && v.number != null,
					});
				}
				const size = values[mainId]?.name ?? values.SIZE?.name ?? '';
				return { id: r.id!, size, values };
			});

		const attr = (key: string) => raw.attributes?.find(a => a.id === key)?.values?.[0]?.name ?? null;
		return {
			id,
			name: raw.names?.[siteId] ?? Object.values(raw.names ?? {})[0] ?? `Guía ${id}`,
			domainId: raw.domain_id ?? null,
			gender: attr('GENDER'),
			brand: attr('BRAND'),
			mainAttributeId: mainId,
			mainName,
			mainUnit,
			columns: [...columns.values()],
			rows,
			status: raw.chart_status === 'INACTIVE' ? 'INACTIVE' : raw.chart_status === 'ACTIVE' ? 'ACTIVE' : null,
			usedBy: [...new Set(productos.filter(p => String(p.atributos?.SIZE_GRID_ID ?? '').trim() === id).map(p => p.nombre))],
		};
	}
}
