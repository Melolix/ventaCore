import type { Producto } from '@base-template/shared';

/**
 * Variantes de producto en la vitrina. Los productos de un rubro con el mismo
 * `grupo` son el mismo artículo en distintas variantes (talle, color…): se
 * muestran en UNA card con un selector, en vez de una card repetida por variante.
 */

/** Talles de ropa en su orden natural (alfabéticamente quedarían L, M, S, XL…). */
const TALLES = ['XXXS', '3XS', 'XXS', '2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'XXXXL', '4XL', '5XL'];

/** Unidades que sabemos comparar, llevadas a una base común por tipo. */
const UNIDADES: Record<string, { tipo: string; factor: number }> = {
	mg: { tipo: 'peso', factor: 0.001 },
	g: { tipo: 'peso', factor: 1 },
	gr: { tipo: 'peso', factor: 1 },
	grs: { tipo: 'peso', factor: 1 },
	kg: { tipo: 'peso', factor: 1000 },
	kgs: { tipo: 'peso', factor: 1000 },
	ml: { tipo: 'volumen', factor: 1 },
	cc: { tipo: 'volumen', factor: 1 },
	cl: { tipo: 'volumen', factor: 10 },
	l: { tipo: 'volumen', factor: 1000 },
	lt: { tipo: 'volumen', factor: 1000 },
	lts: { tipo: 'volumen', factor: 1000 },
	mm: { tipo: 'largo', factor: 1 },
	cm: { tipo: 'largo', factor: 10 },
	m: { tipo: 'largo', factor: 1000 },
	mts: { tipo: 'largo', factor: 1000 },
};

/** "1,5 kg" → { tipo: 'peso', valor: 1500 }; null si no es una cantidad con unidad conocida. */
function medida(s: string): { tipo: string; valor: number } | null {
	const m = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)\.?$/i.exec(s.trim());
	const u = m ? UNIDADES[m[2].toLowerCase()] : undefined;
	return m && u ? { tipo: u.tipo, valor: Number(m[1].replace(',', '.')) * u.factor } : null;
}

/** Compara dos etiquetas de variante: talles por su orden, cantidades y números por valor, el resto alfabético. */
function compareParte(a: string, b: string): number {
	const ta = TALLES.indexOf(a.toUpperCase());
	const tb = TALLES.indexOf(b.toUpperCase());
	if (ta !== -1 && tb !== -1) return ta - tb;
	// Cantidades con unidad: "500 g" antes que "1 kg", "750 ml" antes que "1 l".
	const ma = medida(a);
	const mb = medida(b);
	if (ma && mb && ma.tipo === mb.tipo) return ma.valor - mb.valor;
	const na = Number(a.replace(',', '.'));
	const nb = Number(b.replace(',', '.'));
	if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

/** Orden de las variantes en el selector ("Azul / S" antes que "Azul / M" antes que "Rojo / S"). */
export function compareVariantes(a: Pick<Producto, 'variante'>, b: Pick<Producto, 'variante'>): number {
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

/** Un valor de una característica en el selector de la vitrina. */
export interface OpcionSelector {
	valor: string;
	/** La variante a la que se pasa al elegir este valor. */
	producto: Producto;
	/** Es el valor de la variante que se está viendo. */
	actual: boolean;
	sinStock: boolean;
	/**
	 * Existe la combinación de este valor con lo ya elegido en las otras
	 * características. Si no (no hay "Rojo / XL"), al tocarlo se pasa a la más parecida.
	 */
	exacta: boolean;
}

/** Una característica con sus valores ("Color": Negro, Azul). `nombre` vacío = lista simple. */
export interface Selector {
	nombre: string;
	valores: OpcionSelector[];
}

/**
 * Los selectores de un producto con variantes. Si las variantes tienen sus
 * características con nombre (Color, Talle, Peso…), uno por característica:
 * elegir un valor conserva lo ya elegido en las demás. Si no las tienen (las
 * importadas de ML o cargadas antes), un solo selector con la etiqueta entera.
 */
export function selectoresDe(variantes: Producto[], actual: Producto): Selector[] {
	const nombres = (variantes[0]?.opciones ?? []).map(o => o.nombre);
	const valor = (p: Producto, n: string) => p.opciones?.find(o => o.nombre === n)?.valor ?? '';
	const completas = nombres.length > 0 && variantes.every(v => nombres.every(n => valor(v, n)));
	if (!completas) {
		return [
			{
				nombre: '',
				valores: variantes.map(v => ({ valor: v.variante || v.nombre, producto: v, actual: v.id === actual.id, sinStock: v.stock === 0, exacta: true })),
			},
		];
	}
	return nombres.map(n => {
		const otros = nombres.filter(x => x !== n);
		const valores = [...new Set(variantes.map(v => valor(v, n)))].sort(compareParte);
		return {
			nombre: n,
			valores: valores.map(val => {
				const conValor = variantes.filter(v => valor(v, n) === val);
				const exacta = conValor.find(v => otros.every(o => valor(v, o) === valor(actual, o)));
				// Sin la combinación exacta: la que más coincide con lo elegido, mejor si tiene stock.
				const puntaje = (v: Producto) => otros.filter(o => valor(v, o) === valor(actual, o)).length * 10 + (v.stock !== 0 ? 1 : 0);
				const producto = exacta ?? [...conValor].sort((a, b) => puntaje(b) - puntaje(a))[0];
				return { valor: val, producto, actual: valor(actual, n) === val, sinStock: producto.stock === 0, exacta: !!exacta };
			}),
		};
	});
}
