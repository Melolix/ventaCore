/**
 * Integración con Mercado Libre. Cada rubro conecta su propia cuenta de vendedor
 * vía OAuth (modelo BYO app: primero carga App ID/Secret de SU app de ML).
 *
 * Diferencias con Meta: ML usa **refresh token** (el access token dura 6 h) y
 * cada conexión corresponde a UNA cuenta de vendedor (no hay varios "targets"
 * como las Páginas de Facebook).
 *
 * IMPORTANTE: los tipos de esta vista NUNCA incluyen tokens ni secretos. Los
 * tokens viven solo en las entidades del backend (cifrados).
 */

/** Estado de la conexión OAuth de un rubro con Mercado Libre. */
export enum MlConnectionStatus {
	/** Conexión activa; el access token se refresca solo cuando hace falta. */
	CONNECTED = 'connected',
	/** El refresh token venció (~6 meses) o falló → hay que reconectar. */
	EXPIRED = 'expired',
	/** El usuario revocó los permisos desde ML → hay que reconectar. */
	REVOKED = 'revoked',
}

/**
 * Vista pública (sin tokens) de la conexión de un rubro con Mercado Libre. Es
 * lo que el panel admin ve: estado y cuenta de vendedor conectada.
 */
export interface MlConnection {
	id: string;
	/** Rubro (marca) dueño de la conexión: cada rubro conecta su propia cuenta. */
	rubroId: string;
	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	espacioId: string;
	status: MlConnectionStatus;
	/** ID del usuario/vendedor de ML (ej. "123456789"). */
	mlUserId: string | null;
	/** Nickname del vendedor en ML (para mostrar en el panel). */
	mlNickname: string | null;
	/** Sitio de ML del vendedor (ej. "MLA" para Argentina). */
	siteId: string | null;
	/** Permisos (scopes) otorgados en el consentimiento. */
	scopes: string[];
	/** Vencimiento del access token (ISO). Se refresca automáticamente. */
	tokenExpiresAt: string | null;
	/** Momento de la última conexión exitosa (ISO). */
	connectedAt: string;
}

/** Un producto del catálogo de Mercado Libre encontrado en la búsqueda. */
export interface MlCatalogSearchResult {
	/** Id del producto de catálogo (ej. "MLA18500846"). */
	id: string;
	/** Nombre del producto en el catálogo. */
	name: string;
	/** URL de la miniatura, o null. */
	thumbnail: string | null;
}

/**
 * Datos de un producto del catálogo de ML, listos para autocompletar una fila.
 * Traen categoría, atributos, imagen y descripción ya cargados por ML.
 */
export interface MlCatalogProduct {
	/** Id del producto de catálogo (para enlazar la publicación). */
	catalogProductId: string;
	name: string;
	/** Categoría sugerida (de la predicción por nombre). */
	categoryId: string;
	categoryName: string;
	/** Atributos del catálogo por id → valor (ej. { BRAND: "Apple" }). */
	atributos: Record<string, string>;
	/** Primera imagen del catálogo (URL de ML), o null. */
	imageUrl: string | null;
	description: string | null;
}

/** Resultado de bajar las publicaciones activas de la cuenta de ML. */
export interface MlImportResult {
	/** Productos nuevos creados. */
	imported: number;
	/** Productos ya existentes (por item de ML) que se actualizaron. */
	updated: number;
	/** Total de publicaciones activas encontradas. */
	total: number;
}

/** Resultado de publicar un producto en Mercado Libre. */
export interface MlPublishResult {
	ok: boolean;
	/** Id de la publicación creada (si ok). */
	itemId?: string;
	/** Link público del aviso (si ok). */
	permalink?: string;
	/** Mensaje de error (si !ok). */
	error?: string;
}

/** Una categoría de ML sugerida para un producto (predicción por título). */
export interface MlCategoryPrediction {
	/** Id de la categoría (ej. "MLA1744"). */
	categoryId: string;
	/** Nombre legible de la categoría (ej. "Autos y Camionetas"). */
	categoryName: string;
	/**
	 * De dónde cuelga ("Ropa y Accesorios › Remeras, Musculosas y Chombas"). Hay
	 * varias categorías con el mismo nombre en ramas distintas (ropa, pesca, golf)
	 * y sin la ruta no se distinguen. null si ML no la devolvió.
	 */
	categoryPath: string | null;
	/** Dominio de ML (ej. "MLA-CARS_AND_VANS"), o null. */
	domainId: string | null;
	domainName: string | null;
}

/**
 * Un atributo con el que una categoría de ML permite distinguir las opciones de
 * un mismo producto (talle, color, peso neto, sabor…): los CHILD_PK del dominio.
 */
export interface MlVariationAttr {
	id: string;
	name: string;
	values: MlAttributeValue[];
	/** ML lo marca explícitamente como "variación" (ropa/calzado); el resto varía igual. */
	allowVariations: boolean;
}

/** Nombres que los vendedores usan y no coinciden con el de ML. */
const OPCION_ALIAS: Record<string, string> = {
	talle: 'SIZE',
	talla: 'SIZE',
	numero: 'SIZE',
	color: 'COLOR',
	colores: 'COLOR',
	peso: 'NET_WEIGHT',
	sabor: 'FLAVOR',
};

const normOpcion = (s: string) =>
	s
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

/**
 * A qué atributo de ML corresponde una característica cargada por el vendedor
 * ("Peso" → "Peso neto", "Talle" → SIZE). Empareja por nombre; si no hay,
 * devuelve null y esa característica viaja como atributo propio. Lo usan el
 * servidor (al publicar) y el panel (para no pedir dos veces el mismo dato).
 */
export function matchOpcionAttr(nombre: string, attrs: MlVariationAttr[]): MlVariationAttr | null {
	const n = normOpcion(nombre);
	if (!n) return null;
	const exact = attrs.find(a => normOpcion(a.name) === n);
	if (exact) return exact;
	const alias = OPCION_ALIAS[n];
	if (alias) {
		const byAlias = attrs.find(a => a.id === alias);
		if (byAlias) return byAlias;
	}
	// "Peso" ↔ "Peso neto", "Diseño" ↔ "Diseño de la tela".
	const prefijo = attrs.find(a => normOpcion(a.name).startsWith(n + ' ') || n.startsWith(normOpcion(a.name) + ' '));
	if (prefijo) return prefijo;
	// "Envase" ↔ "Tipo de envase", "Diseño" ↔ "Nombre del diseño": la palabra está en el nombre.
	return attrs.find(a => normOpcion(a.name).split(' ').includes(n)) ?? null;
}

/** Una fila de una guía de talles de ML: un talle con su id de fila. */
export interface MlSizeChartRow {
	/** Id de la fila ("463005:1"); va en SIZE_GRID_ROW_ID al publicar. */
	id: string;
	/** Talle tal como figura en la guía ("M", "42 AR"). */
	size: string;
}

/**
 * ¿Dos talles son el mismo? Las guías guardan el talle con su sistema ("37 AR",
 * "8,5 US") y los productos suelen tenerlo sin ("37"). Ignora mayúsculas, la
 * unidad del final y coma/punto decimal: "37" = "37 AR", "8.5" = "8,5 US", "m" = "M".
 */
export function sameSize(a: string, b: string): boolean {
	const norm = (s: string) =>
		s
			.trim()
			.toLowerCase()
			.replace(/\s+(ar|us|eu|br|uk|mx|cl|co|uy|pe)$/, '')
			.replace(',', '.');
	const x = norm(a);
	const y = norm(b);
	if (!x || !y) return false;
	if (x === y) return true;
	const nx = Number(x);
	const ny = Number(y);
	return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

/** Guía de talles del vendedor en Mercado Libre. */
export interface MlSizeChart {
	id: string;
	name: string;
	/** SPECIFIC (propia del vendedor), BRAND o STANDARD. */
	type: string;
	rows: MlSizeChartRow[];
	/** Tipo de prenda (dominio de ML) para el que se creó, p. ej. "T_SHIRTS". */
	domainId?: string;
	/** Género de la guía ("Hombre", "Sin género"…), si ML lo informa. */
	gender?: string;
	/**
	 * Solo al pedirla por código junto con una categoría: false si la guía es de
	 * OTRO tipo de prenda que esa categoría (ML puede rechazar la publicación).
	 */
	sameDomain?: boolean;
}

/** Guías de talles disponibles para una categoría (y género) del vendedor. */
export interface MlSizeChartsResult {
	/** ¿La categoría usa guía de talles? (ropa y calzado; ML la exige al publicar). */
	required: boolean;
	/** true si faltó el género o la marca: ML los exige para buscar las guías. */
	incomplete: boolean;
	charts: MlSizeChart[];
	/**
	 * Si no hubo guías para el género pedido: las que el vendedor tiene para ese
	 * tipo de prenda con OTRO género (para explicarle por qué no aparece la suya).
	 */
	otherGenders?: Array<{ gender: string; chart: MlSizeChart }>;
}

/**
 * Una columna de la ficha técnica de la guía de talles (POST
 * /domains/$DOMAIN/technical_specs?section=grids): un talle (AR, US, "Talle de
 * marca"…) o una medida (largo del pie, contorno de pecho…).
 */
export interface MlSizeChartColumn {
	id: string;
	name: string;
	/** "string" | "number" | "number_unit" | "list"… */
	valueType: string;
	/** Hay que completarla en todas las filas. */
	required: boolean;
	/** Puede ser el talle principal (lo que el comprador ve en el selector). */
	mainCandidate: boolean;
	/** Acepta más de un valor por fila (solo listas). */
	multivalued: boolean;
	/** Unidades permitidas (number_unit). */
	units: string[];
	defaultUnit: string | null;
	/** Opciones permitidas (list). */
	values: MlAttributeValue[];
	/** Es una medida (largo del pie, pecho, largo de la prenda…), no un talle. */
	isMeasure: boolean;
	/** Medida del cuerpo o de la prenda (ropa); null si ML no lo distingue (ej. calzado). */
	measure: 'BODY' | 'CLOTHING' | null;
}

/** Tipo de medidas de una guía de ropa: del cuerpo o de la prenda. */
export type MlSizeChartMeasureType = 'BODY_MEASURE' | 'CLOTHING_MEASURE';

/** Qué pide ML para crear una guía de talles propia (SPECIFIC) en un dominio. */
export interface MlSizeChartTemplate {
	/** Dominio con prefijo del sitio (ej. "MLA-SNEAKERS"). */
	domainId: string;
	/** Tope de filas (talles) por guía. */
	maxRows: number;
	/** Columnas de cada fila. */
	columns: MlSizeChartColumn[];
	/** Talle principal sugerido (el del país del sitio, ej. AR_SIZE en MLA). */
	suggestedMainId: string | null;
	/** Otros atributos generales de la guía (además de GENDER y BRAND). */
	general: MlSizeChartColumn[];
	/** Ropa (TOPS y BOTTOMS): se puede elegir medidas de la prenda en vez del cuerpo. */
	clothingMeasures: boolean;
}

/** Un valor de una celda: opción de lista (`id`), texto (`name`) o número + unidad. */
export interface MlSizeChartValueInput {
	id?: string;
	name?: string;
	number?: number;
	unit?: string;
}

export interface MlSizeChartCellInput {
	id: string;
	values: MlSizeChartValueInput[];
}

/** Valor de una celda de una guía ya creada: texto, o número + unidad ("23,5 cm"). */
export interface MlSizeChartCellValue {
	name: string;
	number?: number;
	unit?: string;
}

/** Una columna (medida u otro talle) de una guía ya creada, además del talle principal. */
export interface MlManagedSizeChartColumn {
	id: string;
	name: string;
	/** Unidad (cm, US…) si es numérica; null si es texto o lista. */
	unit: string | null;
	/** Se puede corregir (las numéricas); las listas de ML (ej. talle filtrable) se muestran sin editar. */
	editable: boolean;
}

/** Una fila (talle) de una guía ya creada. */
export interface MlManagedSizeChartRow {
	/** Id de la fila en ML (ej. "569686:1"). */
	id: string;
	/** Talle de la fila (no se puede cambiar: ML no lo permite). */
	size: string;
	/** Valores por columna (id → valor). */
	values: Record<string, MlSizeChartCellValue>;
}

/**
 * Guía de talles propia del vendedor, para gestionarla desde VentaCore. ML solo
 * deja cambiarle el nombre, sumar talles y corregir medidas; no cambiar talles,
 * quitar filas ni cambiar género / marca / tipo de talle.
 */
export interface MlManagedSizeChart {
	id: string;
	name: string;
	/** Tipo de producto (dominio de ML, ej. "MLA-SNEAKERS"). */
	domainId: string | null;
	gender: string | null;
	brand: string | null;
	/** Columna del talle principal (ej. "AR_SIZE") y su nombre. */
	mainAttributeId: string;
	mainName: string;
	/** Unidad del talle principal si es numérico ("AR"), para cargar talles nuevos. */
	mainUnit: string | null;
	columns: MlManagedSizeChartColumn[];
	rows: MlManagedSizeChartRow[];
	/** INACTIVE = se pidió borrarla y ML está verificando (la borra en 24 h si nadie la usa). */
	status: 'ACTIVE' | 'INACTIVE' | null;
	/** Productos de este rubro que la usan (nombres). */
	usedBy: string[];
}

/** Celdas para sumar un talle o corregir las medidas de uno. */
export interface MlSizeChartRowInput {
	attributes: MlSizeChartCellInput[];
}

/**
 * Un error de ML al crear una guía (POST /catalog/charts → `errors`): qué celda
 * (columna + talle de la fila) rechazó y por qué. Ej.: code "value_out_of_range".
 */
export interface MlSizeChartError {
	code: string;
	/** Mensaje original de ML (en inglés). */
	message: string;
	/** Columna de la celda (ej. "FOOT_LENGTH"), si el error es de una celda. */
	attributeId: string | null;
	/** Talle de la fila tal como lo informa ML (ej. "37 AR"), si el error es de una fila. */
	row: string | null;
}

/** Alta de una guía de talles propia (SPECIFIC). */
export interface MlCreateSizeChartInput {
	/** Nombre (máx. 60, solo letras, números y espacios). */
	name: string;
	gender: string;
	brand?: string;
	/** Columna que es el talle principal. */
	mainAttributeId: string;
	/** Ropa: medidas del cuerpo (default de ML) o de la prenda. */
	measureType?: MlSizeChartMeasureType;
	/** Atributos generales extra (de `MlSizeChartTemplate.general`). */
	attributes?: MlSizeChartCellInput[];
	rows: Array<{ attributes: MlSizeChartCellInput[] }>;
}

/** Valor permitido de un atributo de ML (para atributos con opciones cerradas). */
export interface MlAttributeValue {
	id: string;
	name: string;
}

/**
 * Un atributo de una categoría de ML. Los `required` son los que ML exige para
 * publicar; alimentan el "Faltan N" de la carga masiva y el editor de atributos.
 */
export interface MlAttribute {
	/** Id del atributo (ej. "BRAND"). */
	id: string;
	/** Nombre legible (ej. "Marca"). */
	name: string;
	/** ¿ML lo exige para publicar? */
	required: boolean;
	/** Tipo de valor: "string" | "number" | "list" | "boolean" | "number_unit"... */
	valueType: string;
	/** Opciones permitidas (vacío = texto libre). Puede venir recortado. */
	values: MlAttributeValue[];
	/** true si `values` se recortó (hay más opciones que las devueltas). */
	valuesTruncated: boolean;
}

/**
 * Desglose de comisión de Mercado Libre para un precio dado. Lo devuelve la API
 * `listing_prices` de ML: cuánto cobra ML por vender a ese precio (porcentaje +
 * costo fijo por unidad, que se cae en precios altos).
 */
export interface MlFeeBreakdown {
	/** Precio de venta consultado. */
	price: number;
	/** Comisión total en $ (porcentaje + fijo). */
	saleFeeAmount: number;
	/** Parte porcentual de la comisión (ej. 13 = 13%). */
	percentageFee: number;
	/** Costo fijo por unidad en $ (0 en precios altos). */
	fixedFee: number;
	/** Moneda (ej. "ARS"). */
	currencyId: string;
	/** Precio mínimo con el que ML deja publicar en esa categoría (null si no informa). */
	minPrice?: number | null;
}

/** Cotización del envío gratis de Mercado Libre para un producto/precio. */
export interface MlShippingQuote {
	/** Lo que paga el VENDEDOR por el envío gratis (list_cost, ya con el descuento de ML). */
	cost: number;
	/** ML exige envío gratis a este precio (superó el mínimo de la categoría). Si es false, lo paga el comprador. */
	mandatory: boolean;
	/** Moneda (ej. "ARS"). */
	currencyId: string;
}

/**
 * Cálculo completo de precios para publicar en Mercado Libre. A partir del costo
 * y el precio de venta en ML, dice cuánto queda neto tras la comisión y cuánta
 * ganancia real hay. `loss` = true si el neto no cubre el costo (bloquea guardar).
 */
export interface MlPriceCalc {
	/** Precio en ML consultado. */
	precioMl: number;
	/** Comisión de ML en $ a ese precio. */
	comision: number;
	/** Desglose de la comisión (porcentaje + fijo). */
	fee: MlFeeBreakdown;
	/** Neto que recibe el vendedor: precioMl − comisión (sin contar envío). */
	neto: number;
	/** Costo del producto (si se envió), para calcular la ganancia. */
	costo: number | null;
	/** Ganancia real: neto − costo (null si no hay costo). */
	ganancia: number | null;
	/** true si neto < costo: se estaría vendiendo a pérdida. */
	loss: boolean;
	/**
	 * Precio en ML SUGERIDO para que, tras la comisión, quede una ganancia
	 * objetivo intacta (costo + margen). null si no se pidió (sin costo/margen).
	 */
	precioMlSugerido: number | null;
}

/**
 * Métricas de la cuenta de Mercado Libre para el dashboard. Junta datos de la API
 * de ML (publicaciones, visitas, reputación del vendedor) con los nuestros
 * (ventas y preguntas ya guardadas). Todo por rubro (una cuenta de ML).
 */
export interface MlMetrics {
	/** Cantidad de publicaciones por estado. */
	publicaciones: {
		active: number;
		paused: number;
		closed: number;
		total: number;
	};
	/** Ventas concretadas (de nuestra tabla): cantidad, facturación bruta y neto tras comisión. */
	ventas: {
		count: number;
		facturacion: number;
		comision: number;
		neto: number;
		currencyId: string;
	};
	/** Preguntas: sin responder, respondidas y tasa de respuesta (0..1, null si no hay). */
	preguntas: {
		unanswered: number;
		answered: number;
		total: number;
		responseRate: number | null;
	};
	/** Visitas de los últimos 30 días: total + serie diaria (para un mini gráfico). */
	visitas: {
		total: number;
		days: { date: string; total: number }[];
	};
	/** Reputación del vendedor (de ML). null si ML no la devuelve. */
	reputacion: {
		levelId: string | null;
		powerSellerStatus: string | null;
		transactionsTotal: number;
		transactionsCompleted: number;
		transactionsCanceled: number;
		ratingsPositive: number;
		ratingsNeutral: number;
		ratingsNegative: number;
		/** Tasas (0..1) del período que informa ML (típicamente 365 días). */
		claimsRate: number;
		cancellationsRate: number;
		delayedHandlingRate: number;
	} | null;
}

/**
 * Estado de Mercado Libre de un rubro para el panel. Cada rubro trae su propia
 * app (modelo BYO): primero configura App ID/Secret, después conecta por OAuth.
 * Nunca incluye el App Secret ni tokens.
 */
export interface MlRubroState {
	/** ¿El rubro ya cargó las credenciales de su app de Mercado Libre? */
	appConfigured: boolean;
	/** App ID configurado (público), para mostrar/prefilar. null si no hay. */
	appId: string | null;
	/** Conexión OAuth (null si configuró la app pero todavía no autorizó). */
	connection: MlConnection | null;
}

/** Un vendedor que ofrece el mismo producto en Mercado Libre. */
export interface MlCompetidor {
	itemId: string | null;
	precio: number;
	envioGratis: boolean;
	/** Lo despacha Mercado Libre (Full). */
	full: boolean;
	tiendaOficial: boolean;
}

/**
 * Cómo está el precio de un producto frente a la competencia en ML.
 *  - ganando / compartiendo / perdiendo: lo dice ML (publicación de catálogo).
 *  - en_precio / caro: comparación solo por precio contra el más barato.
 *  - sin_competencia: nadie más lo vende. sin_datos: no está en el catálogo de ML.
 */
export type MlCompetenciaEstado = 'ganando' | 'compartiendo' | 'perdiendo' | 'en_precio' | 'caro' | 'sin_competencia' | 'sin_datos';

export interface MlCompetencia {
	estado: MlCompetenciaEstado;
	/** Cómo se encontró la ficha del catálogo: por la publicación/enlace o por el código de barras. */
	fuente: 'catalogo' | 'ean' | null;
	miPrecio: number | null;
	/** Precio con el que ML dice que ganarías (solo publicaciones de catálogo). */
	precioParaGanar: number | null;
	/** El precio más bajo de la competencia. */
	mejorPrecio: number | null;
	/** Cuántos otros vendedores lo ofrecen. */
	vendedores: number;
	/** Los más baratos (hasta 5), de menor a mayor. */
	competidores: MlCompetidor[];
	catalogProductId: string | null;
	catalogName: string | null;
	/** Link a la ficha del producto en Mercado Libre. */
	permalink: string | null;
	actualizado: string;
}

/** Qué queda vendiendo un producto a un precio dado. */
export interface MlEstudioEscenario {
	precio: number;
	/** Comisión de ML a ese precio. */
	comision: number;
	comisionPct: number;
	/** Envío a cargo del vendedor a ese precio (0 si lo paga el comprador o faltan las medidas). */
	envio: number;
	/** null si el producto no tiene costo cargado. */
	ganancia: number | null;
	/** Ganancia sobre el costo, en %. */
	gananciaPct: number | null;
}

/**
 * Estudio de mercado de un producto: a cuánto se vende en ML y cuánto quedaría de
 * ganancia, con el costo cargado, vendiéndolo al precio más barato y al del medio.
 */
export interface MlEstudio {
	/**
	 * Cómo se encontró en ML: por la publicación, el código de barras, el nombre
	 * (aproximado) o — si el producto exacto no está — por productos parecidos de
	 * otras marcas en la misma medida (solo una referencia). null = nada.
	 */
	via: 'publicacion' | 'ean' | 'nombre' | 'similares' | null;
	catalogProductId: string | null;
	/** Con qué producto de ML se comparó (para chequear que sea el mismo). */
	catalogName: string | null;
	/** Con `via: 'similares'`: los productos parecidos que se tomaron de referencia. */
	similares: string[];
	/** El código de barras llevó a un producto con otro nombre: la comparación no es confiable. */
	noCoincide: boolean;
	permalink: string | null;
	vendedores: number;
	precioMin: number | null;
	/** El precio del medio: la mitad vende más barato y la mitad más caro. */
	precioMediana: number | null;
	competidores: MlCompetidor[];
	costo: number | null;
	/** Vendiendo al precio más barato. */
	alMin: MlEstudioEscenario | null;
	/** Vendiendo al precio del medio. */
	alMedio: MlEstudioEscenario | null;
	/** Faltan las medidas del paquete: el envío no está descontado. */
	envioSinMedidas: boolean;
	actualizado: string;
}

/** Resultado de una acción en lote sobre publicaciones de ML (pausar, activar, vacaciones). */
export interface MlBulkResult {
	/** Cuántas publicaciones cambiaron. */
	ok: number;
	/** Las que ML no dejó cambiar, con el motivo. */
	failed: Array<{ id: string; nombre: string; error: string }>;
}
