/**
 * Emparejar un producto con una ficha del catálogo de ML por el NOMBRE, sin IA.
 *
 * Se usa cuando no hay código de barras. La regla es conservadora: es preferible
 * decir "sin datos" antes que comparar contra otro producto (una pinza de otra
 * marca, o la caja de 25 en vez de la unidad), porque el precio que saldría de
 * ahí sería falso. Por eso además del parecido de palabras se exige que
 * coincidan la marca, las medidas (500 g, 115 mm) y los códigos de modelo.
 */

/** Ficha candidata tal como la devuelve `/products/search` (solo lo que usamos). */
export interface CatalogCandidate {
	id?: string;
	name?: string;
	children_ids?: string[];
	attributes?: Array<{ id?: string; value_name?: string | null }>;
}

const STOPWORDS = new Set([
	'de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'por', 'en', 'y', 'o', 'a', 'x', 'un', 'una', 'the', 'color', 'modelo', 'marca', 'tipo',
]);

/** Palabras que indican que la ficha es un pack/caja y no la unidad. */
const PACK = /\b(pack|caja|cajas|kit|combo|set|juego|lote|docena|pares|unidades|unid|uds|pcs|piezas)\b/;

/** Palabras de relleno de las fichas: no hacen que sea otro producto. */
const FILLER = new Set([
	'professional', 'profesional', 'original', 'clasico', 'clasica', 'nuevo', 'nueva', 'unidad', 'premium', 'oficial',
	'azul', 'rojo', 'roja', 'negro', 'negra', 'blanco', 'blanca', 'verde', 'gris', 'amarillo', 'amarilla', 'naranja',
]);

/** Palabras que cambian el producto: si están de un lado, tienen que estar del otro. */
const QUALIFIERS = [
	'integral', 'light', 'diet', 'zero', 'descafeinado', 'suave', 'intenso', 'saborizada', 'compuesta', 'organico', 'organica',
	'inalambrico', 'inalambrica', 'bateria', 'mini', 'max', 'pro', 'plus', 'xl', 'infantil', 'usado', 'reacondicionado', 'repuesto',
];

/** Unidades de medida → dimensión y factor a la unidad base (g, ml, mm, w, v). */
const UNITS: Record<string, [string, number]> = {
	kg: ['peso', 1000], kilo: ['peso', 1000], kilos: ['peso', 1000], g: ['peso', 1], gr: ['peso', 1], grs: ['peso', 1], gramos: ['peso', 1],
	l: ['vol', 1000], lt: ['vol', 1000], lts: ['vol', 1000], litro: ['vol', 1000], litros: ['vol', 1000], ml: ['vol', 1], cc: ['vol', 1], cm3: ['vol', 1],
	m: ['largo', 1000], mt: ['largo', 1000], mts: ['largo', 1000], metros: ['largo', 1000], cm: ['largo', 10], mm: ['largo', 1],
	w: ['pot', 1], watts: ['pot', 1], kw: ['pot', 1000], hp: ['hp', 1], v: ['volt', 1], volts: ['volt', 1], a: ['amp', 1], ah: ['ah', 1], mah: ['ah', 0.001],
	pulgadas: ['pulg', 1], pulg: ['pulg', 1],
};

export function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/(\d)\s*["”]/g, '$1 pulgadas ')
		.replace(/(\d),(\d)/g, '$1.$2')
		// Fracciones (7/8, 1 1/4): una sola palabra, para no confundir 11/16 con 11.
		.replace(/(\d+)\s*\/\s*(\d+)/g, '$1f$2')
		// "250x300" y "x10" son números separados; "12unidades" es un pack.
		.replace(/(\d)\s*x\s*(?=\d)/g, '$1 x ')
		.replace(/\bx(\d)/g, 'x $1')
		.replace(/(\d)\s*(unidades|unid|uds|un|u)\b/g, '$1 unidades')
		.replace(/[^a-z0-9.]+/g, ' ')
		.replace(/\.(?!\d)/g, ' ')
		.trim();
}

/** Medidas que aparecen en un texto, como "peso:1000" (1 kg y 1000 grs dan lo mismo). */
export function measures(norm: string): Set<string> {
	const out = new Set<string>();
	const re = /(\d+(?:\.\d+)?)\s*([a-z]+\d?)\b/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(norm))) {
		const unit = UNITS[m[2]];
		if (unit) out.add(`${unit[0]}:${Math.round(parseFloat(m[1]) * unit[1] * 100) / 100}`);
	}
	return out;
}

/** Números de un texto: todos, y los "sueltos" (los que no son una medida con su unidad). */
function numbers(norm: string): { all: Set<string>; bare: Set<string> } {
	const all = new Set<string>();
	const bare = new Set<string>();
	const tokens = norm.split(' ');
	tokens.forEach((t, i) => {
		const glued = /^(\d+(?:\.\d+)?)([a-z]+\d?)$/.exec(t);
		if (glued && UNITS[glued[2]]) {
			all.add(String(parseFloat(glued[1])));
			return;
		}
		if (!/^\d+(\.\d+)?$/.test(t)) return;
		const n = String(parseFloat(t));
		all.add(n);
		if (!UNITS[tokens[i + 1] ?? '']) bare.add(n);
	});
	return { all, bare };
}

/** ¿Dicen lo mismo en fracciones (7/8) y en "sin algo" / "con algo"? Si no, es otro producto. */
function sameDetails(ours: string, theirs: string): boolean {
	const fr = (t: string) => t.split(' ').filter(w => /^\d+f\d+$/.test(w)).sort().join(',');
	if (fr(ours) !== fr(theirs)) return false;
	const sin = (t: string) => [...` ${t} `.matchAll(/ sin (\w+)/g)].map(m => m[1]);
	const tiene = (t: string, w: string) => ` ${t} `.includes(` ${w} `) && !` ${t} `.includes(` sin ${w} `);
	return !sin(theirs).some(w => tiene(ours, w)) && !sin(ours).some(w => tiene(theirs, w));
}

function words(norm: string): string[] {
	return norm.split(' ').filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/** Códigos de modelo: mezclan letras y números y tienen 4+ caracteres (dwd024, gsb13re). */
function modelCodes(tokens: string[]): string[] {
	return tokens.filter(t => t.length >= 4 && /[a-z]/.test(t) && /\d/.test(t) && !/^\d+(\.\d+)?[a-z]{1,3}$/.test(t));
}

/**
 * Qué tan seguro es que la ficha sea el mismo producto: 0 = no lo es; de 0.6 para
 * arriba se considera el mismo. Devuelve 0 apenas algo no cierra.
 */
export function matchScore(productName: string, candidate: CatalogCandidate): number {
	const ours = normalize(productName);
	const theirs = normalize(candidate.name ?? '');
	if (!ours || !theirs) return 0;
	const attr = (id: string) => candidate.attributes?.find(a => a.id === id)?.value_name ?? '';
	const haystack = normalize([candidate.name, attr('BRAND'), attr('MODEL'), attr('LINE'), attr('ALPHANUMERIC_MODEL')].filter(Boolean).join(' '));

	// Marca: si la ficha tiene una, tiene que estar en nuestro nombre.
	const brand = normalize(attr('BRAND'));
	if (brand && !` ${ours} `.includes(` ${brand} `)) return 0;

	if (!sameDetails(ours, theirs)) return 0;

	// Pack vs. unidad.
	if (PACK.test(theirs) !== PACK.test(ours)) return 0;

	// Variantes (integral, light, inalámbrico…): o los dos o ninguno.
	const tOurs = new Set(ours.split(' '));
	const tTheirs = new Set(theirs.split(' '));
	if (QUALIFIERS.some(q => tOurs.has(q) !== tTheirs.has(q))) return 0;

	// Medidas: las de una misma dimensión tienen que coincidir.
	const mOurs = measures(ours);
	const mTheirs = measures(haystack);
	for (const m of mOurs) {
		const dim = m.split(':')[0];
		const same = [...mTheirs].filter(t => t.startsWith(`${dim}:`));
		if (same.length && !same.includes(m)) return 0;
	}

	const wOurs = words(ours);
	const wTheirs = new Set(words(haystack));
	const compact = haystack.replace(/ /g, '');
	// Códigos de modelo: tienen que estar (aunque en la ficha vengan con guion o espacio).
	for (const code of modelCodes(wOurs)) {
		if (!compact.includes(code)) return 0;
	}
	// Y al revés: si la ficha es de un modelo puntual, tiene que ser el nuestro.
	const oursCompact = ours.replace(/ /g, '');
	for (const code of modelCodes(words(theirs))) {
		if (!oursCompact.includes(code)) return 0;
	}

	// Números sueltos (GWS 700 vs. GWS 850, "6 x 150"): los nuestros tienen que
	// estar en la ficha, y la ficha no puede traer uno que nosotros no tengamos.
	const nOurs = numbers(ours);
	const nTheirs = numbers(haystack);
	if ([...nOurs.bare].some(n => !nTheirs.all.has(n))) return 0;
	if ([...numbers(theirs).bare].some(n => !nOurs.all.has(n))) return 0;

	if (!wOurs.length) return 0;
	const hits = wOurs.filter(w => wTheirs.has(w) || (w.length >= 4 && compact.includes(w))).length;
	const coverage = hits / wOurs.length;
	// Nuestras palabras (sabor, tipo, línea) tienen que estar en la ficha: "durazno"
	// contra una de ciruela es otro producto. Se tolera una cada cinco.
	const propias = wOurs.filter(w => !/^\d/.test(w) && !FILLER.has(w));
	const faltan = propias.filter(w => !wTheirs.has(w) && !(w.length >= 4 && compact.includes(w))).length;
	if (faltan > Math.floor(propias.length / 5)) return 0;
	// La ficha tampoco puede decir mucho más que nosotros (sería otra variante).
	const wName = words(theirs);
	// Si la ficha agrega dos o más palabras propias ("mix legumbres sin tacc", "sin
	// azúcar agregada") es otra variante. Salvo que coincida un código de modelo:
	// ahí el producto ya está identificado y lo demás es descripción.
	if (!modelCodes(wOurs).length) {
		const negada = / sin /.test(` ${theirs} `) && !/ sin /.test(` ${ours} `);
		const extras = wName.filter(w => !FILLER.has(w) && !UNITS[w] && !/^\d/.test(w) &&!ours.includes(w)).length + (negada ? 1 : 0);
		if (extras >= 2) return 0;
	}
	const back =wName.length ? wName.filter(w => ours.includes(w)).length / wName.length : 0;
	const score = coverage * 0.7 + back * 0.3;
	// Con marca confirmada alcanza un poco menos de parecido.
	return brand ? Math.min(1, score + 0.1) : score;
}

/** El nombre sin la marca ni el relleno: lo que se busca para encontrar parecidos de otras marcas. */
export function similarQuery(productName: string, brand = ''): string {
	const b = normalize(brand);
	return normalize(productName)
		.split(' ')
		.filter(w => w && w !== b && !FILLER.has(w))
		.join(' ');
}

/**
 * ¿La ficha es el mismo TIPO de producto en la misma medida, aunque sea de otra
 * marca? Sirve de referencia de precio cuando el producto exacto no está en ML
 * (una llave combinada de 7 mm de otra marca). Mismo tipo, misma medida, mismos
 * números chicos, y ni pack contra unidad ni otra variante.
 */
export function isSimilar(productName: string, candidate: CatalogCandidate, brand = ''): boolean {
	const ours = similarQuery(productName, brand);
	const theirs = normalize(candidate.name ?? '');
	if (!ours || !theirs) return false;
	if (!sameDetails(ours, theirs)) return false;
	if (PACK.test(theirs) !== PACK.test(ours)) return false;
	const tOurs = new Set(ours.split(' '));
	const tTheirs = new Set(theirs.split(' '));
	if (QUALIFIERS.some(q => tOurs.has(q) !== tTheirs.has(q))) return false;

	const mOurs = measures(ours);
	const mTheirs = measures(theirs);
	for (const m of mOurs) {
		const dim = m.split(':')[0];
		const same = [...mTheirs].filter(t => t.startsWith(`${dim}:`));
		if (same.length && !same.includes(m)) return false;
	}
	// Números chicos (medidas sin unidad, cantidades); los largos son códigos de cada marca.
	const chico = (n: string) => n.replace('.', '').length <= 3;
	const nOurs = numbers(ours);
	const nTheirs = numbers(theirs);
	if ([...nOurs.bare].filter(chico).some(n => !nTheirs.all.has(n))) return false;
	if ([...nTheirs.bare].filter(chico).some(n => !nOurs.all.has(n))) return false;

	// El tipo de producto: la primera palabra tiene que estar, y casi todas las demás.
	const propias = words(ours).filter(w => !/^\d/.test(w) && !UNITS[w]);
	if (propias.length < 2 || !tTheirs.has(propias[0])) return false;
	const faltan = propias.filter(w => !tTheirs.has(w)).length;
	return faltan <= Math.floor(propias.length / 4);
}

/** ¿Los dos nombres comparten al menos una palabra con peso? Sirve para detectar un código de barras que apunta a otro producto. */
export function sharesWord(a: string, b: string): boolean {
	const wb = new Set(words(normalize(b)).filter(w => w.length >= 4));
	return words(normalize(a)).some(w => w.length >= 4 && wb.has(w));
}

/** Umbral desde el que una ficha se toma como el mismo producto. */
export const MATCH_MIN = 0.6;
