<template>
	<svg viewBox="0 0 96 72" role="img" :aria-label="label" class="block" fill="none" stroke-linecap="round" stroke-linejoin="round">
		<title>{{ label }}</title>
		<!-- Silueta (pie, torso, prenda) en gris; la medida resaltada en el color principal. -->
		<g class="text-surface-400" stroke="currentColor" stroke-width="2">
			<path v-for="(d, i) in art.outline" :key="`o${i}`" :d="d" />
		</g>
		<g class="text-surface-300 dark:text-surface-600" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3">
			<path v-for="(d, i) in art.guides" :key="`g${i}`" :d="d" />
		</g>
		<g class="text-primary" stroke="currentColor" stroke-width="2.5">
			<path v-for="(d, i) in art.measure" :key="`m${i}`" :d="d" />
		</g>
	</svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MeasureKind, ProductKind } from '@/modules/admin/utils/sizeChartMeasures';

/** Dibujo de línea de una medida (con la línea a medir resaltada) o de un tipo de producto. */
const props = defineProps<{
	kind: MeasureKind | ProductKind;
	/** Texto alternativo (para lectores de pantalla). */
	label: string;
}>();

/** Flecha horizontal de x1 a x2 (con puntas). */
function hArrow(x1: number, x2: number, y: number): string {
	return `M${x1} ${y} H${x2} M${x1 + 4} ${y - 3.5} L${x1} ${y} L${x1 + 4} ${y + 3.5} M${x2 - 4} ${y - 3.5} L${x2} ${y} L${x2 - 4} ${y + 3.5}`;
}
/** Flecha vertical de y1 a y2 (con puntas). */
function vArrow(x: number, y1: number, y2: number): string {
	return `M${x} ${y1} V${y2} M${x - 3.5} ${y1 + 4} L${x} ${y1} L${x + 3.5} ${y1 + 4} M${x - 3.5} ${y2 - 4} L${x} ${y2} L${x + 3.5} ${y2 - 4}`;
}

/** Círculo como path (para los dedos de la huella). */
function circle(cx: number, cy: number, r: number): string {
	return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}
/** Huella vista desde arriba: planta + cinco dedos (el gordo más grande). */
const FOOT = [
	'M44 19 C55 18 60 27 59 37 C58 49 56 59 49 64 C43 67 37 63 36 54 C35 46 35 38 36 30 C37 23 39 19 44 19 Z',
	circle(55, 12, 4.2),
	circle(47.5, 10, 3),
	circle(41.5, 11, 2.6),
	circle(36.5, 13.5, 2.3),
	circle(33, 17.5, 2),
];
/** Persona de frente (cabeza, brazos y torso) para las medidas del cuerpo. */
const TORSO = [
	circle(48, 7, 5),
	'M44 12 V15 M52 12 V15',
	'M34 15 L62 15 C67 15 68 20 66 25 C64 32 62 36 62 42 C62 48 66 54 66 64 L30 64 C30 54 34 48 34 42 C34 36 32 32 30 25 C28 20 29 15 34 15 Z',
	'M33 16 C25 19 23 30 22 46 M63 16 C71 19 73 30 74 46',
];
const TSHIRT = 'M34 8 L42 11 Q48 15 54 11 L62 8 L82 18 L75 30 L66 26 L66 66 L30 66 L30 26 L21 30 L14 18 Z';
const PANTS = ['M30 8 L66 8 L70 66 L52 66 L48 30 L44 66 L26 66 Z', 'M30 13 H66'];
const SHOE = ['M8 52 L8 42 C8 38 12 36 16 36 L32 36 C38 36 42 30 46 24 L56 24 C60 30 70 36 82 40 C90 43 90 52 84 54 L12 54 C10 54 8 54 8 52 Z', 'M8 48 H88'];

/** Contorno de una medida alrededor del cuerpo: frente (resaltado) y espalda (punteada). */
function around(y: number, x1: number, x2: number): { measure: string[]; guides: string[] } {
	return { measure: [hArrow(x1, x2, y)], guides: [`M${x1} ${y} Q48 ${y - 7} ${x2} ${y}`] };
}

const art = computed<{ outline: string[]; guides: string[]; measure: string[] }>(() => {
	switch (props.kind) {
		case 'foot':
			return { outline: FOOT, guides: ['M55 7.8 H76', 'M46 66 H76'], measure: [vArrow(74, 7.8, 66)] };
		case 'chest':
			return { outline: TORSO, ...around(27, 31, 65) };
		case 'waist':
			return { outline: TORSO, ...around(42, 34, 62) };
		case 'hip':
			return { outline: TORSO, ...around(56, 31, 65) };
		case 'garmentLength':
			return { outline: [TSHIRT], guides: [], measure: [vArrow(38, 10, 66)] };
		case 'garmentWidth':
			return { outline: [TSHIRT], guides: [], measure: [hArrow(30, 66, 32)] };
		case 'pantsWidth':
			return { outline: PANTS, guides: [], measure: [hArrow(30, 66, 18)] };
		case 'pantsLength':
			return { outline: PANTS, guides: ['M30 8 H18', 'M26 66 H18'], measure: [vArrow(20, 8, 66)] };
		case 'inseam':
			return { outline: PANTS, guides: [], measure: [`M50 32 L53 64 M47 35.5 L50 32 L53.6 35.2 M49.6 61 L53 64 L56 60.5`] };
		case 'rise':
			return { outline: PANTS, guides: ['M40 30 H48'], measure: [vArrow(40, 13, 30)] };
		case 'thigh':
			return { outline: PANTS, guides: [], measure: [hArrow(28, 47, 36)] };
		case 'shoe':
			return { outline: SHOE, guides: [], measure: [] };
		case 'shirt':
			return { outline: [TSHIRT], guides: [], measure: [] };
		case 'pants':
			return { outline: PANTS, guides: [], measure: [] };
		default:
			// Medida sin dibujo propio: una cinta métrica.
			return {
				outline: ['M14 28 H82 V44 H14 Z'],
				guides: [],
				measure: ['M22 28 V36 M30 28 V34 M38 28 V36 M46 28 V34 M54 28 V36 M62 28 V34 M70 28 V36 M78 28 V34'],
			};
	}
});
</script>
