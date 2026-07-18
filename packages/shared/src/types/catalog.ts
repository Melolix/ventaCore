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
