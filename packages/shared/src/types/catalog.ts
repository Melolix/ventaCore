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
	createdAt: string;
	updatedAt: string;
	/** Cantidad de productos (solo lo devuelven los endpoints públicos). */
	productCount?: number;
}

export interface Producto {
	id: string;
	rubroId: string;
	nombre: string;
	descripcion: string | null;
	precio: number | null;
	imageUrl: string | null;
	createdAt: string;
	updatedAt: string;
}
