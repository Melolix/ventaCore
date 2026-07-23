/**
 * Un "espacio" es el negocio de un CM (admin). El superadmin los crea y
 * administra; cada espacio tiene un único admin y su propia vitrina pública
 * en /s/{slug}.
 */

/**
 * Tipo de espacio: define cómo se presenta la vitrina.
 *  - `catalog`: catálogo comercial clásico (rubros con productos, precio y WhatsApp).
 *  - `apps`: página de una empresa de apps; cada rubro es una app con links de descarga
 *    (Android/iOS) en lugar de productos.
 */
export enum EspacioType {
	CATALOG = 'catalog',
	APPS = 'apps',
}

export const ALL_ESPACIO_TYPES: EspacioType[] = [EspacioType.CATALOG, EspacioType.APPS];

export interface Espacio {
	id: string;
	nombre: string;
	/** Cómo se presenta la vitrina (catálogo comercial vs. página de apps). */
	type: EspacioType;
	/** Identificador (subdominio en dev: {slug}.localhost) */
	slug: string;
	/** Dominio propio del negocio (ej: mitienda.com), o null */
	domain: string | null;
	descripcion: string | null;
	logoUrl: string | null;
	active: boolean;
	// Contacto y página "Sobre Nosotros" (editable por el admin)
	whatsapp: string | null;
	instagramUrl: string | null;
	aboutHeadline: string | null;
	aboutText: string | null;
	aboutImageUrl: string | null;
	createdAt: string;
	updatedAt: string;
	/** Solo en el panel superadmin: email del admin y cantidad de rubros. */
	adminEmail?: string | null;
	rubroCount?: number;
}
