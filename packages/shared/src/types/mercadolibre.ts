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
	/** Dominio de ML (ej. "MLA-CARS_AND_VANS"), o null. */
	domainId: string | null;
	domainName: string | null;
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
