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

/**
 * Canales integrables que el superadmin habilita/deshabilita por espacio.
 * Para sumar uno nuevo alcanza con agregarlo acá (y wirear su nav/gateo en el
 * panel). La habilitación se guarda en `Espacio.channels` como { key: boolean };
 * una clave AUSENTE se considera habilitada (default on).
 */
export const ESPACIO_CHANNELS = [
	{ key: 'mercadolibre', label: 'Mercado Libre' },
	{ key: 'instagram', label: 'Instagram' },
] as const;

export type EspacioChannel = (typeof ESPACIO_CHANNELS)[number]['key'];

/** ¿El espacio tiene habilitado ese canal? Clave ausente = habilitado. */
export function channelEnabled(
	espacio: { channels?: Record<string, boolean> | null } | null | undefined,
	key: EspacioChannel,
): boolean {
	return espacio?.channels?.[key] !== false;
}

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
	/** Habilitación de canales por el superadmin (clave ausente = habilitado). */
	channels: Record<string, boolean>;
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
