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
	/** UID de Firebase del admin dueño del rubro */
	ownerId: string;
	nombre: string;
	descripcion: string | null;
	imageUrl: string | null;
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
