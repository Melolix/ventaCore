/**
 * Catálogo del admin: rubros (sectores comerciales) y los productos que
 * contiene cada uno. Cada rubro pertenece al admin que lo creó (`ownerId`).
 */

/** Estado de publicación de un rubro. */
export enum RubroStatus {
	ACTIVE = 'active',
	DRAFT = 'draft',
}

export const ALL_RUBRO_STATUSES: RubroStatus[] = [RubroStatus.ACTIVE, RubroStatus.DRAFT];

/**
 * Plataformas para las que está disponible una app (solo espacios tipo `apps`).
 * Definen los íconos que se muestran en la vitrina y qué descargas aparecen.
 */
export enum AppPlatform {
	ANDROID = 'android',
	IOS = 'ios',
	WEB = 'web',
	DESKTOP = 'desktop',
}

export const ALL_APP_PLATFORMS: AppPlatform[] = [
	AppPlatform.ANDROID,
	AppPlatform.IOS,
	AppPlatform.WEB,
	AppPlatform.DESKTOP,
];

export interface Rubro {
	id: string;
	/** Espacio (negocio) al que pertenece el rubro */
	espacioId: string;
	nombre: string;
	descripcion: string | null;
	imageUrl: string | null;
	/** Logo/marca propia del rubro (se muestra junto al título en la vitrina). */
	logoUrl: string | null;
	/** Instagram propio del rubro (cada rubro es un negocio distinto). */
	instagramUrl: string | null;
	/**
	 * Destino de publicación en Meta: id del `MetaTarget` (Página FB + IG) al que
	 * publica este rubro. null si el rubro todavía no eligió una cuenta. El botón
	 * "Publicar" de sus productos se habilita solo cuando está seteado.
	 */
	metaTargetId: string | null;
	/** Plataformas para las que está la app (solo espacios tipo `apps`). Definen los íconos. */
	platforms: AppPlatform[];
	/** Link de descarga en Google Play o al APK (solo espacios tipo `apps`). */
	androidUrl: string | null;
	/** Link de descarga en la App Store (solo espacios tipo `apps`). */
	iosUrl: string | null;
	/** Link para abrir la versión web/escritorio (solo espacios tipo `apps`). */
	webUrl: string | null;
	status: RubroStatus;
	/** Si el rubro ofrece suscripción (habilita el tab de suscripciones en la vitrina). */
	subscriptionsEnabled: boolean;
	createdAt: string;
	updatedAt: string;
	/** Cantidad de productos (solo lo devuelven los endpoints públicos). */
	productCount?: number;
}

/**
 * De dónde salió el dato de un producto. Se muestra en la grilla de carga
 * masiva para que el usuario sepa de cuál fiarse y cuál revisar.
 */
export enum ProductoSource {
	/** Cargado a mano en la app. */
	MANUAL = 'manual',
	/** Importado de un Excel/CSV. */
	EXCEL = 'excel',
	/** Autocompletado por código de barras (catálogo de Mercado Libre). */
	SCAN = 'scan',
	/** Completado por IA (foto + nombre). */
	IA = 'ia',
	/** Bajado de una cuenta de Mercado Libre existente. */
	ML = 'ml',
}

export const ALL_PRODUCTO_SOURCES: ProductoSource[] = [
	ProductoSource.MANUAL,
	ProductoSource.EXCEL,
	ProductoSource.SCAN,
	ProductoSource.IA,
	ProductoSource.ML,
];

/**
 * Estado de completitud de un producto (derivado, no se persiste). Maneja los
 * badges de la grilla de carga masiva.
 *  - `draft`   → borrador, todavía no se quiere publicar.
 *  - `missing` → le faltan datos OBLIGATORIOS para publicar (rojo, "Faltan N").
 *  - `review`  → publicable pero conviene revisar/completar (amarillo).
 *  - `ready`   → listo para publicar (verde).
 */
export enum ProductoEstado {
	DRAFT = 'draft',
	MISSING = 'missing',
	REVIEW = 'review',
	READY = 'ready',
}

/** Atributos de Mercado Libre por id de atributo (ej. { BRAND: 'Natura' }). */
export type ProductoAtributos = Record<string, string>;

/**
 * Tipo de publicación en Mercado Libre. Cambia la comisión que cobra ML:
 *  - `gold_special` (Clásica): comisión estándar. Es el default.
 *  - `gold_pro` (Premium): más comisión, más exposición y cuotas sin interés.
 */
export type MlListingType = 'gold_special' | 'gold_pro';

export const ML_LISTING_TYPES: MlListingType[] = ['gold_special', 'gold_pro'];

export interface Producto {
	id: string;
	rubroId: string;
	nombre: string;
	descripcion: string | null;
	/** Precio de venta en la tienda propia (vitrina). costo + margen. */
	precio: number | null;
	/** Precio de costo (del Excel/proveedor). Base para calcular el margen. */
	precioCosto: number | null;
	/** Precio en Mercado Libre (absorbe la comisión para dejar la ganancia intacta). */
	precioMl: number | null;
	/** Tipo de publicación en ML: 'gold_special' (Clásica) | 'gold_pro' (Premium). */
	mlListingType: MlListingType;
	/** Portada: la imagen que se muestra en la vitrina (= `imagenes[0]`). */
	imageUrl: string | null;
	/** Galería completa de imágenes (la primera es la portada). Todas van a ML. */
	imagenes: string[];
	/**
	 * Pestaña/sección a la que pertenece (solo apps con varias audiencias, ej.
	 * Athlix: "usuario" | "entrenador" | "admin"). null = sin sección. Si un
	 * rubro tiene productos con >= 2 secciones distintas, la vitrina muestra
	 * pestañas; si no, galería plana.
	 */
	seccion: string | null;
	// ── Campos comerciales / Mercado Libre (ML-ready) ──
	/** Código interno del negocio (SKU). */
	sku: string | null;
	/** Código de barras / EAN. Mercado Libre lo llama GTIN. */
	gtin: string | null;
	/** Stock disponible. null = sin definir. */
	stock: number | null;
	/** Id de categoría de Mercado Libre (ej. "MLA1234"). */
	mlCategoryId: string | null;
	/** Path legible de la categoría, cacheado ("Alimentos › Aceites"). */
	mlCategoryName: string | null;
	/** Atributos de ML por id de atributo. Los obligatorios varían por categoría. */
	atributos: ProductoAtributos | null;
	/** De dónde salió el dato (catálogo/IA/Excel/manual). */
	source: ProductoSource;
	/** Borrador: el usuario todavía no lo quiere publicar. */
	isDraft: boolean;
	/** Id de la publicación en Mercado Libre (ej. "MLA123..."), null si no se publicó. */
	mlItemId: string | null;
	/** Link público del aviso en Mercado Libre, o null. */
	mlPermalink: string | null;
	/** Id del producto de catálogo de ML al que se enlaza al publicar, o null. */
	mlCatalogProductId: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Campos escribibles de un producto (alta/edición, individual o en lote). */
export type ProductoWrite = Partial<
	Pick<
		Producto,
		| 'nombre'
		| 'descripcion'
		| 'precio'
		| 'precioCosto'
		| 'precioMl'
		| 'mlListingType'
		| 'imageUrl'
		| 'imagenes'
		| 'seccion'
		| 'sku'
		| 'gtin'
		| 'stock'
		| 'mlCategoryId'
		| 'mlCategoryName'
		| 'mlCatalogProductId'
		| 'atributos'
		| 'source'
		| 'isDraft'
	>
>;

/** Una fila del alta masiva: producto + rubro destino. `id` presente = update. */
export interface BatchProductoItem extends ProductoWrite {
	/** Si viene, se actualiza ese producto; si no, se crea uno nuevo. */
	id?: string;
	/** Rubro (categoría interna) al que va el producto. Obligatorio. */
	rubroId: string;
	nombre: string;
}

/** Resultado de procesar una fila del alta masiva (mismo orden que la entrada). */
export interface BatchProductoResult {
	index: number;
	ok: boolean;
	/** Id del producto creado/actualizado (null si falló). */
	id: string | null;
	/** Mensaje de error si `ok` es false. */
	error: string | null;
}

/**
 * Un atributo obligatorio de una categoría de ML. Lo provee la API de ML en la
 * fase de integración; por ahora la validación local no lo usa (siempre `[]`).
 */
export interface MlRequiredAttribute {
	id: string;
	name: string;
}

/** Resultado de evaluar la completitud de un producto. */
export interface ProductoReadiness {
	estado: ProductoEstado;
	/** Campos/atributos que faltan para poder publicar. */
	faltantes: string[];
}

/** Producto tal como se evalúa (acepta filas de la grilla aún sin persistir). */
export type ProductoLike = Partial<
	Pick<
		Producto,
		'nombre' | 'precio' | 'stock' | 'imageUrl' | 'descripcion' | 'mlCategoryId' | 'atributos' | 'isDraft'
	>
>;

/**
 * Evalúa si un producto está listo para publicar. Diseñada para que la fase de
 * Mercado Libre le pase el schema de atributos obligatorios de la categoría; sin
 * ese schema (`requiredAttrs = []`) valida solo lo comercial básico.
 */
export function evaluarProducto(p: ProductoLike, requiredAttrs: MlRequiredAttribute[] = []): ProductoReadiness {
	if (p.isDraft) return { estado: ProductoEstado.DRAFT, faltantes: [] };

	// Obligatorios para publicar (rojo si faltan).
	const faltantes: string[] = [];
	if (!p.nombre || !p.nombre.trim()) faltantes.push('nombre');
	if (p.precio == null) faltantes.push('precio');
	if (p.stock == null) faltantes.push('stock');
	if (!p.mlCategoryId) faltantes.push('categoría');
	for (const attr of requiredAttrs) {
		if (!p.atributos || !p.atributos[attr.id]) faltantes.push(attr.name);
	}
	if (faltantes.length) return { estado: ProductoEstado.MISSING, faltantes };

	// Recomendados (amarillo si faltan): publicable, pero conviene completar.
	const recomendados: string[] = [];
	if (!p.imageUrl) recomendados.push('imagen');
	if (!p.descripcion || !p.descripcion.trim()) recomendados.push('descripción');
	if (recomendados.length) return { estado: ProductoEstado.REVIEW, faltantes: recomendados };

	return { estado: ProductoEstado.READY, faltantes: [] };
}
