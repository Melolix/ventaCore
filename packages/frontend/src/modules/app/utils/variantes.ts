import type { Producto } from '@base-template/shared';

/**
 * Variantes de producto en la vitrina. Los productos de un rubro con el mismo
 * `grupo` son el mismo artículo en distintas variantes (talle, color…): se
 * muestran en UNA card con un selector, en vez de una card repetida por variante.
 */

/** Talles de ropa en su orden natural (alfabéticamente quedarían L, M, S, XL…). */
const TALLES = ['XXXS', '3XS', 'XXS', '2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'XXXXL', '4XL', '5XL'];

/** Compara dos etiquetas de variante: talles por su orden, números por valor, el resto alfabético. */
function compareParte(a: string, b: string): number {
	const ta = TALLES.indexOf(a.toUpperCase());
	const tb = TALLES.indexOf(b.toUpperCase());
	if (ta !== -1 && tb !== -1) return ta - tb;
	const na = Number(a.replace(',', '.'));
	const nb = Number(b.replace(',', '.'));
	if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

/** Orden de las variantes en el selector ("Azul / S" antes que "Azul / M" antes que "Rojo / S"). */
export function compareVariantes(a: Producto, b: Producto): number {
	const pa = (a.variante ?? '').split(' / ');
	const pb = (b.variante ?? '').split(' / ');
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const c = compareParte(pa[i]?.trim() ?? '', pb[i]?.trim() ?? '');
		if (c !== 0) return c;
	}
	return 0;
}

/**
 * Variantes por grupo, ya ordenadas. Solo entran los grupos con 2 o más
 * productos: un grupo de uno es, a los fines de la vitrina, un producto suelto.
 */
export function groupVariantes(productos: Producto[]): Map<string, Producto[]> {
	const all = new Map<string, Producto[]>();
	for (const p of productos) {
		if (!p.grupo) continue;
		const list = all.get(p.grupo);
		if (list) list.push(p);
		else all.set(p.grupo, [p]);
	}
	const out = new Map<string, Producto[]>();
	for (const [grupo, list] of all) {
		if (list.length > 1) out.set(grupo, [...list].sort(compareVariantes));
	}
	return out;
}

/** La variante que se muestra al entrar: la primera con stock (o la primera, si no hay). */
export function varianteInicial(variantes: Producto[]): Producto {
	return variantes.find(v => v.stock !== 0) ?? variantes[0];
}
