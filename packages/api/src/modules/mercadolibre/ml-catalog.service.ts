import { BadRequestException, Injectable } from '@nestjs/common';
import type {
	MlAttribute,
	MlCategoryPrediction,
	MlCatalogProduct,
	MlCatalogSearchResult,
	MlCreateSizeChartInput,
	MlSizeChart,
	MlSizeChartColumn,
	MlSizeChartsResult,
	MlSizeChartTemplate,
	MlSizeChartValueInput,
	MlVariationAttr,
} from '@base-template/shared';
import { MlConnectionService } from './ml-connection.service';

/** Tope de opciones que devolvemos por atributo (BRAND/MODEL pueden tener miles). */
const MAX_ATTR_VALUES = 60;

/** Forma cruda de un atributo de la API de ML (solo lo que usamos). */
interface RawMlAttribute {
	id: string;
	name: string;
	value_type?: string;
	/** Rol del atributo en el modelo User Products (PARENT_PK, CHILD_PK, FAMILY…). */
	hierarchy?: string;
	tags?: Record<string, boolean>;
	values?: Array<{ id?: string; name?: string }>;
}

/** Forma cruda de una guía de talles de ML (solo lo que usamos). */
interface RawMlChart {
	id?: string | number;
	names?: Record<string, string>;
	type?: string;
	domain_id?: string;
	attributes?: Array<{ id?: string; values?: Array<{ name?: string }> }>;
	main_attribute_id?: string;
	rows?: Array<{ id?: string; attributes?: Array<{ id?: string; values?: Array<{ name?: string }> }> }>;
}

/** Tope de guías que detallamos por búsqueda (cada una es un pedido a ML). */
const MAX_CHARTS = 15;

/** Atributo de la guía de talles (id de la guía). ML lo exige en ropa y calzado. */
const SIZE_GRID_ATTR = 'SIZE_GRID_ID';

/** Atributo de la ficha técnica de la guía de talles (ahí los tags son un array). */
interface RawGridAttribute {
	id: string;
	name?: string;
	value_type?: string;
	tags?: string[];
	hierarchy?: string;
	default_unit_id?: string;
	units?: Array<{ id?: string; name?: string }>;
	values?: Array<{ id?: string; name?: string }>;
}

/** Componente de la ficha técnica: anida componentes y/o trae atributos. */
interface RawSpecComponent {
	ui_config?: { max_allowed?: number };
	components?: RawSpecComponent[];
	attributes?: RawGridAttribute[];
}

/** Atributo de una guía en el formato del alta de ML. */
type MlChartCell = {
	id: string;
	values: Array<{ id?: string; name?: string; struct?: { number: number; unit: string } }>;
};

/** Atributos generales de la guía que completamos con los del producto. */
const GRID_PRODUCT_ATTRS = ['GENDER', 'BRAND'];

/** País de cada sitio, para sugerir su talle como principal (AR_SIZE en MLA). */
const SITE_COUNTRY: Record<string, string> = {
	MLA: 'AR',
	MLB: 'BR',
	MLM: 'MX',
	MLC: 'CL',
	MCO: 'CO',
	MLU: 'UY',
	MPE: 'PE',
	MEC: 'EC',
};

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

	private readonly minPrices = new Map<string, number | null>();

	/**
	 * Precio mínimo con el que ML deja publicar en una categoría (dato público de
	 * la categoría; cambia según el rubro: $1.000 en la mayoría, más en otras).
	 * null si ML no informa uno o no se pudo consultar.
	 */
	async getMinPrice(categoryId: string): Promise<number | null> {
		const id = categoryId.trim();
		if (!id) return null;
		if (this.minPrices.has(id)) return this.minPrices.get(id) ?? null;
		const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } }).catch(() => null);
		if (!res?.ok) return null;
		const body = (await res.json().catch(() => ({}))) as { settings?: { minimum_price?: number | null } };
		const min = typeof body.settings?.minimum_price === 'number' && body.settings.minimum_price > 0 ? body.settings.minimum_price : null;
		this.minPrices.set(id, min);
		return min;
	}

	/** Corta con un mensaje claro si el precio está por debajo del mínimo de la categoría. */
	async assertMinPrice(categoryId: string | null | undefined, price: number | null | undefined): Promise<void> {
		if (!categoryId || price == null) return;
		const min = await this.getMinPrice(categoryId);
		if (min != null && price < min) {
			const fmt = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;
			throw new BadRequestException(
				`Mercado Libre no permite publicar en esta categoría por debajo de ${fmt(min)} y el precio es ${fmt(price)}. Subí el precio de Mercado Libre o vendelo en pack.`,
			);
		}
	}

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

		const preds = (Array.isArray(body) ? body : []).filter(p => p.category_id);
		// La ruta de cada categoría (endpoint público): varias se llaman igual
		// ("Remeras") y cuelgan de ropa, pesca, golf… sin la ruta parecen la misma.
		const paths = await Promise.all(preds.map(p => this.categoryPath(p.category_id!)));
		return preds.map((p, i) => ({
			categoryId: p.category_id!,
			categoryName: p.category_name ?? p.category_id!,
			categoryPath: paths[i],
			domainId: p.domain_id ?? null,
			domainName: p.domain_name ?? null,
		}));
	}

	/** "Ropa y Accesorios › Remeras, Musculosas y Chombas" (null si ML no responde). */
	private async categoryPath(categoryId: string): Promise<string | null> {
		try {
			const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(categoryId)}`, { headers: { accept: 'application/json' } });
			if (!res.ok) return null;
			const cat = (await res.json()) as { path_from_root?: Array<{ name?: string }> };
			const names = (cat.path_from_root ?? []).map(x => x.name).filter(Boolean);
			return names.length ? names.join(' › ') : null;
		} catch {
			return null;
		}
	}

	/**
	 * Atributos con los que la categoría permite VARIAR un mismo producto (talle,
	 * color…): los `CHILD_PK` marcados `allow_variations`. Las publicaciones de
	 * una misma familia tienen que traerlos cargados, con distinto valor, para que
	 * Mercado Libre las junte en una sola página con selector.
	 */
	async getVariationAttributes(categoryId: string): Promise<MlVariationAttr[]> {
		const id = categoryId.trim();
		if (!id) return [];
		const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(id)}/attributes`, {
			headers: { accept: 'application/json' },
		});
		const body = (await res.json().catch(() => [])) as RawMlAttribute[];
		if (!res.ok || !Array.isArray(body)) return [];
		// Todos los CHILD_PK editables: en ropa ML marca "allow_variations" (color,
		// talle), pero en el resto (yerba: peso neto, sabor) varían igual sin esa marca.
		return body
			.filter(a => a.hierarchy === 'CHILD_PK' && !a.tags?.read_only && !a.tags?.hidden)
			.map(a => ({
				id: a.id,
				name: a.name,
				values: (a.values ?? [])
					.filter(v => v.id && v.name)
					.map(v => ({ id: v.id!, name: v.name! }))
					.slice(0, MAX_ATTR_VALUES),
				allowVariations: !!a.tags?.allow_variations,
			}));
	}

	/** Normaliza una guía cruda: nombre + filas con su talle. */
	private toSizeChart(raw: RawMlChart, siteId: string): MlSizeChart {
		const rows = (raw.rows ?? [])
			.map(r => {
				const attr = (id?: string) => r.attributes?.find(a => a.id === id)?.values?.[0]?.name?.trim();
				// El talle de la fila: SIZE (lo arma ML) o, si no, el atributo principal.
				return { id: String(r.id ?? ''), size: attr('SIZE') || attr(raw.main_attribute_id) || '' };
			})
			.filter(r => r.id && r.size);
		const name = raw.names?.[siteId] ?? Object.values(raw.names ?? {})[0] ?? String(raw.id ?? '');
		const gender = raw.attributes?.find(a => a.id === 'GENDER')?.values?.[0]?.name;
		return {
			id: String(raw.id ?? ''),
			name,
			type: raw.type ?? 'SPECIFIC',
			rows,
			...(raw.domain_id ? { domainId: raw.domain_id } : {}),
			...(gender ? { gender } : {}),
		};
	}

	/** Dominio de catálogo de una categoría, con y sin prefijo de sitio ("MLA-T_SHIRTS" / "T_SHIRTS"). */
	private async categoryDomain(categoryId: string): Promise<{ full: string; short: string }> {
		const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(categoryId.trim())}`, { headers: { accept: 'application/json' } });
		const cat = (await res.json().catch(() => ({}))) as { settings?: { catalog_domain?: string } };
		const full = cat.settings?.catalog_domain ?? '';
		return { full, short: full.replace(/^[A-Z]{3}-/, '') };
	}

	/**
	 * Ficha técnica de la guía de talles del dominio: qué atributos lleva la guía
	 * (género, marca), cuál puede ser el talle principal y qué medidas son
	 * obligatorias por fila. Es lo que hay que respetar para crear una guía.
	 */
	async getSizeChartSpec(rubroId: string, espacioId: string, categoryId: string, gender: string, brand: string): Promise<unknown> {
		const { full } = await this.categoryDomain(categoryId);
		if (!full) throw new BadRequestException('La categoría no tiene dominio de catálogo');
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		// La ficha de la guía depende de la marca y el género (se mandan en el body).
		const res = await fetch(`${this.apiHost}/domains/${encodeURIComponent(full)}/technical_specs?section=grids`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
			body: JSON.stringify({
				attributes: [
					{ id: 'BRAND', value_name: brand.trim(), values: [{ name: brand.trim() }] },
					{ id: 'GENDER', value_name: gender.trim(), values: [{ name: gender.trim() }] },
				],
			}),
		});
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre: no se pudo leer la ficha de la guía de talles (${body.message || res.statusText})`);
		return body;
	}

	/**
	 * Qué columnas pide ML para crear una guía propia: la ficha técnica de la guía
	 * (la misma de `getSizeChartSpec`) ya ordenada en columnas por fila (talles y
	 * medidas) y atributos generales, más el talle principal sugerido.
	 */
	async getSizeChartTemplate(
		rubroId: string,
		espacioId: string,
		categoryId: string,
		gender: string,
		brand: string,
	): Promise<MlSizeChartTemplate> {
		if (!gender.trim()) throw new BadRequestException('Falta el género para armar la guía de talles');
		const { full } = await this.categoryDomain(categoryId);
		if (!full) throw new BadRequestException('La categoría no tiene dominio de catálogo');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const genderValue = await this.genderValue(categoryId, gender);

		// GENDER va con el id del valor: la ficha lo espera como opción de la lista.
		const attributes: Array<Record<string, unknown>> = [
			{ id: 'GENDER', value_id: genderValue.id ?? null, value_name: genderValue.name, values: [{ id: genderValue.id ?? null, name: genderValue.name }] },
		];
		if (brand.trim()) attributes.push({ id: 'BRAND', value_name: brand.trim(), values: [{ name: brand.trim() }] });

		const res = await fetch(`${this.apiHost}/domains/${encodeURIComponent(full)}/technical_specs?section=grids`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
			body: JSON.stringify({ attributes }),
		});
		const spec = (await res.json().catch(() => ({}))) as { input?: { groups?: RawSpecComponent[] }; message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre: no se pudo leer la ficha de la guía de talles (${spec.message || res.statusText})`);

		// Los atributos vienen anidados: grupos → componente GRID → componentes.
		let maxRows = 0;
		const raw = new Map<string, RawGridAttribute>();
		const walk = (nodes: RawSpecComponent[] = []) => {
			for (const n of nodes) {
				if (n.ui_config?.max_allowed) maxRows = Math.max(maxRows, n.ui_config.max_allowed);
				for (const a of n.attributes ?? []) if (a.id && !raw.has(a.id)) raw.set(a.id, a);
				walk(n.components);
			}
		};
		walk(spec.input?.groups);

		const columns: MlSizeChartColumn[] = [];
		const general: MlSizeChartColumn[] = [];
		for (const a of raw.values()) {
			const tags = new Set(a.tags ?? []);
			if (GRID_PRODUCT_ATTRS.includes(a.id) || tags.has('grid_template_required')) continue;
			if (a.value_type === 'grid_id' || a.value_type === 'grid_row_id') continue;
			const required = tags.has('required');
			// Ocultos / de solo lectura solo si son obligatorios (ej. FILTRABLE_SIZE en TOPS y BOTTOMS).
			if (!required && (tags.has('hidden') || tags.has('read_only') || tags.has('fixed'))) continue;

			const mainCandidate = tags.has('main_attribute_candidate');
			const column: MlSizeChartColumn = {
				id: a.id,
				name: a.name ?? a.id,
				valueType: a.value_type ?? 'string',
				required,
				mainCandidate,
				multivalued: tags.has('multivalued'),
				units: (a.units ?? []).map(u => u.id ?? '').filter(Boolean),
				defaultUnit: a.default_unit_id ?? null,
				values: (a.values ?? []).filter(v => v.id && v.name).map(v => ({ id: v.id!, name: v.name! })),
			};
			// Talles y medidas van por fila (CHILD_PK); lo demás es general de la guía.
			const isRow =
				a.hierarchy === 'CHILD_PK' ||
				mainCandidate ||
				a.id === 'SIZE' ||
				tags.has('BODY_MEASURE') ||
				tags.has('CLOTHING_MEASURE') ||
				tags.has('variation_attribute');
			if (isRow) columns.push(column);
			else if (required) general.push(column);
		}
		if (!columns.some(c => c.mainCandidate)) {
			throw new BadRequestException('Mercado Libre no permite crear guías de talles propias en esta categoría');
		}

		// Talle principal sugerido: el del país del sitio (AR_SIZE en MLA) o SIZE.
		const country = SITE_COUNTRY[siteId];
		const candidates = columns.filter(c => c.mainCandidate);
		const suggested =
			candidates.find(c => country && c.id === `${country}_SIZE`) ?? candidates.find(c => c.id === 'SIZE') ?? candidates[0];

		return { domainId: full, maxRows: maxRows || 75, columns, suggestedMainId: suggested?.id ?? null, general };
	}

	/** Crea una guía de talles propia (SPECIFIC) en la cuenta del vendedor y la devuelve con sus filas. */
	async createSizeChart(rubroId: string, espacioId: string, categoryId: string, input: MlCreateSizeChartInput): Promise<MlSizeChart> {
		// ML acepta hasta 60 caracteres, solo letras, números y espacios.
		const name = input.name
			.replace(/[^\p{L}\p{N} ]+/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60)
			.trim();
		if (!name) throw new BadRequestException('El nombre de la guía tiene que tener letras o números');
		if (!input.gender.trim()) throw new BadRequestException('Falta el género de la guía de talles');
		const rows = input.rows
			.map(r => ({ attributes: r.attributes.filter(c => c.values.length).map(c => this.toMlCell(c.id, c.values)) }))
			.filter(r => r.attributes.length);
		if (!rows.length) throw new BadRequestException('La guía de talles necesita al menos un talle');
		if (rows.some(r => !r.attributes.some(a => a.id === input.mainAttributeId))) {
			throw new BadRequestException('Todos los talles tienen que tener completo el talle principal');
		}

		const { short } = await this.categoryDomain(categoryId);
		if (!short) throw new BadRequestException('La categoría no tiene dominio de catálogo');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const genderValue = await this.genderValue(categoryId, input.gender);

		const attributes: MlChartCell[] = [{ id: 'GENDER', values: [genderValue] }];
		if (input.brand?.trim()) attributes.push({ id: 'BRAND', values: [{ name: input.brand.trim() }] });
		for (const c of input.attributes ?? []) {
			if (c.values.length && !GRID_PRODUCT_ATTRS.includes(c.id)) attributes.push(this.toMlCell(c.id, c.values));
		}

		const res = await fetch(`${this.apiHost}/catalog/charts`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
			body: JSON.stringify({
				names: { [siteId]: name },
				// Sin el prefijo del sitio: ML lo agrega según site_id.
				domain_id: short,
				site_id: siteId,
				main_attribute: { attributes: [{ site_id: siteId, id: input.mainAttributeId }] },
				attributes,
				rows,
			}),
		});
		const body = (await res.json().catch(() => ({}))) as RawMlChart & { message?: string; cause?: unknown };
		if (!res.ok) {
			// ML explica en `cause` qué columna o fila no le gustó: lo pasamos tal cual.
			const cause = body.cause ? ` (${JSON.stringify(body.cause).slice(0, 400)})` : '';
			throw new BadRequestException(`Mercado Libre: no se pudo crear la guía de talles: ${body.message || res.statusText}${cause}`);
		}
		return this.toSizeChart(body, siteId);
	}

	/** Valor de GENDER con su id de ML (la guía lo espera como opción de la lista). */
	private async genderValue(categoryId: string, gender: string): Promise<{ id?: string; name: string }> {
		const name = gender.trim();
		const res = await fetch(`${this.apiHost}/categories/${encodeURIComponent(categoryId.trim())}/attributes`, {
			headers: { accept: 'application/json' },
		});
		const attrs = (await res.json().catch(() => [])) as RawMlAttribute[];
		const values = (Array.isArray(attrs) ? attrs : []).find(a => a.id === 'GENDER')?.values ?? [];
		const match = values.find(v => v.id === name || v.name?.toLowerCase() === name.toLowerCase());
		return match?.id && match.name ? { id: match.id, name: match.name } : { name };
	}

	/** Celda de la guía en el formato de ML (number_unit siempre con struct). */
	private toMlCell(id: string, values: MlSizeChartValueInput[]): MlChartCell {
		return {
			id,
			values: values.map(v => {
				if (v.number != null && Number.isFinite(v.number) && v.unit) {
					return { name: `${String(v.number).replace('.', ',')} ${v.unit}`, struct: { number: v.number, unit: v.unit } };
				}
				if (v.id) return v.name ? { id: v.id, name: v.name } : { id: v.id };
				return { name: (v.name ?? '').trim() };
			}),
		};
	}

	/** Trae una guía de talles por id (con sus filas). */
	async getSizeChart(accessToken: string, siteId: string, chartId: string): Promise<MlSizeChart> {
		const res = await fetch(`${this.apiHost}/catalog/charts/${encodeURIComponent(chartId.trim())}`, {
			headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
		});
		const body = (await res.json().catch(() => ({}))) as RawMlChart & { message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre: no se pudo leer la guía de talles (${body.message || res.statusText})`);
		return this.toSizeChart(body, siteId);
	}

	/**
	 * Una guía por su código (el que ML le muestra al vendedor al crearla). Es el
	 * camino directo cuando el buscador no la encuentra: la búsqueda de ML exige
	 * que coincidan tipo de prenda, género y marca.
	 */
	async getSizeChartById(rubroId: string, espacioId: string, chartId: string, categoryId?: string): Promise<MlSizeChart> {
		const id = chartId.trim();
		if (!/^[0-9]+$/.test(id)) throw new BadRequestException('El código de la guía de talles son solo números (ej. 9762179).');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const chart = await this.getSizeChart(accessToken, siteId, id);
		// ¿Es del mismo tipo de prenda que la categoría del producto?
		if (categoryId?.trim() && chart.domainId) {
			const { short } = await this.categoryDomain(categoryId).catch(() => ({ short: '' }));
			if (short) chart.sameDomain = short === chart.domainId.replace(/^[A-Z]{3}-/, '');
		}
		return chart;
	}

	/**
	 * Guías de talles del vendedor para una categoría. En ropa (remeras, camisas,
	 * pantalones…) ML exige publicar con una guía PROPIA del vendedor y cada
	 * publicación apunta a la fila de su talle. `required` indica si la
	 * categoría la usa. ML exige filtrar por género Y marca (las guías se arman
	 * así): sin alguno de los dos devuelve `incomplete` en vez de buscar.
	 */
	async getSizeCharts(rubroId: string, espacioId: string, categoryId: string, gender?: string, brand?: string): Promise<MlSizeChartsResult> {
		const id = categoryId.trim();
		const none = { required: false, incomplete: false, charts: [] };
		if (!id) return none;

		// ¿La categoría usa guía de talles? Lo dice su lista de atributos.
		const attrsRes = await fetch(`${this.apiHost}/categories/${encodeURIComponent(id)}/attributes`, { headers: { accept: 'application/json' } });
		const attrs = (await attrsRes.json().catch(() => [])) as RawMlAttribute[];
		if (!Array.isArray(attrs) || !attrs.some(a => a.id === 'SIZE_GRID_ID')) return none;
		if (!gender?.trim() || !brand?.trim()) return { required: true, incomplete: true, charts: [] };

		// El dominio de la categoría (la búsqueda lo pide SIN el prefijo del sitio).
		const catRes = await fetch(`${this.apiHost}/categories/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
		const cat = (await catRes.json().catch(() => ({}))) as { settings?: { catalog_domain?: string } };
		const domain = (cat.settings?.catalog_domain ?? '').replace(/^[A-Z]{3}-/, '');
		if (!domain) return { required: true, incomplete: false, charts: [] };

		const { accessToken, mlUserId, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const headers = { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` };
		const search = (g: string) =>
			fetch(`${this.apiHost}/catalog/charts/search?limit=50`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					domain_id: domain,
					site_id: siteId,
					seller_id: Number(mlUserId),
					attributes: [
						{ id: 'GENDER', values: [{ name: g }] },
						{ id: 'BRAND', values: [{ name: brand.trim() }] },
					],
				}),
			});
		/**
		 * Sin guías para ese género: buscamos en los demás géneros de la categoría,
		 * solo para poder decirle al vendedor "tenés una, pero es de otro género"
		 * (la guía tiene que coincidir con el género del producto).
		 */
		const otherGenders = async (): Promise<MlSizeChartsResult['otherGenders']> => {
			const generos = (attrs.find(a => a.id === 'GENDER')?.values ?? [])
				.map(v => v.name ?? '')
				.filter(n => n && n.trim().toLowerCase() !== gender.trim().toLowerCase());
			const out: NonNullable<MlSizeChartsResult['otherGenders']> = [];
			await Promise.all(
				generos.map(async g => {
					const r = await search(g).catch(() => null);
					if (!r?.ok) return;
					const b = (await r.json().catch(() => ({}))) as { charts?: RawMlChart[] };
					for (const c of (b.charts ?? []).filter(x => x.id != null).slice(0, 5)) {
						const chart = c.rows?.length ? this.toSizeChart(c, siteId) : await this.getSizeChart(accessToken, siteId, String(c.id)).catch(() => this.toSizeChart(c, siteId));
						out.push({ gender: g, chart });
					}
				}),
			);
			// ML puede devolver la misma guía bajo más de un género: una sola vez cada una.
			const porGuia = new Map<string, { gender: string; chart: MlSizeChart }>();
			for (const o of out) {
				const prev = porGuia.get(o.chart.id);
				if (prev) prev.gender += ` / ${o.gender}`;
				else porGuia.set(o.chart.id, { ...o });
			}
			return [...porGuia.values()];
		};
		const res = await search(gender.trim());
		const body = (await res.json().catch(() => ({}))) as { charts?: RawMlChart[]; message?: string; errors?: unknown; cause?: unknown };
		// Sin guías para ese filtro ML responde 404: no es un error para el usuario.
		if (!res.ok) {
			if (res.status === 404) return { required: true, incomplete: false, charts: [], otherGenders: await otherGenders() };
			throw new BadRequestException(`Mercado Libre: no se pudieron buscar las guías de talles (${body.message || res.statusText}${body.errors || body.cause ? " — " + JSON.stringify(body.errors ?? body.cause) : ""})`);
		}

		// La búsqueda puede traer las filas vacías: se completan pidiendo cada guía.
		const found = (body.charts ?? []).filter(c => c.id != null).slice(0, MAX_CHARTS);
		const charts = await Promise.all(
			found.map(c => (c.rows?.length ? this.toSizeChart(c, siteId) : this.getSizeChart(accessToken, siteId, String(c.id)).catch(() => this.toSizeChart(c, siteId)))),
		);
		return { required: true, incomplete: false, charts, ...(charts.length ? {} : { otherGenders: await otherGenders() }) };
	}

	/** ¿La categoría exige guía de talles para publicar? */
	async requiresSizeGrid(categoryId: string): Promise<boolean> {
		const attrs = await this.getCategoryAttributes(categoryId).catch(() => [] as MlAttribute[]);
		return attrs.some(a => a.id === SIZE_GRID_ATTR);
	}

	/**
	 * Atributos OBLIGATORIOS de una categoría (endpoint público de ML). Devuelve
	 * los `required` más la guía de talles, con sus opciones recortadas a un tope.
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
			// La guía de talles (SIZE_GRID_ID) no viene con el tag required, pero en ropa
			// y calzado ML la exige al publicar: la tratamos como obligatoria para que
			// cuente como dato faltante y no se pierda al cambiar de categoría.
			.filter(a => a.tags?.required || a.id === SIZE_GRID_ATTR)
			.map(a => {
				const values = (a.values ?? [])
					.filter(v => v.id && v.name)
					.map(v => ({ id: v.id!, name: v.name! }));
				return {
					id: a.id,
					name: a.id === SIZE_GRID_ATTR ? 'Guía de talles' : a.name,
					required: true,
					valueType: a.value_type ?? 'string',
					values: values.slice(0, MAX_ATTR_VALUES),
					valuesTruncated: values.length > MAX_ATTR_VALUES,
				};
			});
	}
}
