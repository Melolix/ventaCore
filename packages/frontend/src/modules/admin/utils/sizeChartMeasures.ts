/**
 * Dibujos y explicaciones de "cómo medir" para las columnas de una guía de talles
 * de Mercado Libre. ML nombra las medidas por id (FOOT_LENGTH, CHEST_CIRCUMFERENCE,
 * GARMENT_LENGTH_FROM…); acá las agrupamos en unos pocos tipos con su dibujo.
 */

/** Tipo de medida (cada uno tiene su dibujo y su texto `measureHow.<tipo>`). */
export type MeasureKind =
	| 'foot'
	| 'chest'
	| 'waist'
	| 'hip'
	| 'garmentLength'
	| 'garmentWidth'
	| 'pantsWidth'
	| 'pantsLength'
	| 'inseam'
	| 'rise'
	| 'thigh'
	| 'generic';

/** Tipo de producto de la guía (para el dibujo del encabezado). */
export type ProductKind = 'shoe' | 'shirt' | 'pants';

/** De qué tipo es una medida según su id de ML. El orden importa: las de prenda primero. */
export function measureKind(id: string): MeasureKind {
	const s = id.toUpperCase();
	if (s.includes('FOOT')) return 'foot';
	if (s.includes('INSEAM')) return 'inseam';
	if (s.includes('RISE')) return 'rise';
	if (s.includes('THIGH')) return 'thigh';
	if (s.startsWith('GARMENT_WAIST') || s.startsWith('GARMENT_HIP')) return 'pantsWidth';
	if (s.startsWith('GARMENT_LENGTH') || s.startsWith('GARMENT_SLEEVE')) return 'garmentLength';
	if (s.startsWith('GARMENT_')) return 'garmentWidth';
	if (s.includes('WAIST_TO_ANKLE') || s.includes('LEG_LENGTH')) return 'pantsLength';
	if (s.includes('CHEST') || s.includes('BUST')) return 'chest';
	if (s.includes('WAIST')) return 'waist';
	if (s.includes('HIP')) return 'hip';
	return 'generic';
}

/** Valor de ejemplo (en cm) de cada tipo de medida, para el placeholder del campo. */
const MEASURE_EXAMPLES: Record<MeasureKind, string> = {
	foot: '23,5',
	chest: '92',
	waist: '74',
	hip: '98',
	garmentLength: '68',
	garmentWidth: '50',
	pantsWidth: '40',
	pantsLength: '100',
	inseam: '76',
	rise: '26',
	thigh: '30',
	generic: '30',
};

export function measureExample(id: string): string {
	return MEASURE_EXAMPLES[measureKind(id)];
}

/** Dominios de calzado y de pantalones (sin el prefijo del sitio). */
const SHOE_DOMAINS = /SNEAKER|SHOE|BOOT|SANDAL|CLOG|LOAFER|OXFORD|HEEL|WEDGE|SLIPPER|FLAT|ESPADRILLE|FOOTWEAR/;
const PANTS_DOMAINS = /PANTS|JEANS|SHORTS|LEGGING|SKIRT|BERMUDA|JOGGER/;

/** Tipo de producto a partir del dominio de ML y de las medidas que pide. */
export function productKind(domainId: string, columnIds: string[]): ProductKind {
	const d = domainId.toUpperCase();
	if (SHOE_DOMAINS.test(d) || columnIds.some(id => id.toUpperCase().includes('FOOT'))) return 'shoe';
	if (PANTS_DOMAINS.test(d)) return 'pants';
	return 'shirt';
}
