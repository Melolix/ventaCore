<template>
	<Dialog
		:visible="visible"
		modal
		:header="$t('admin.carga.ml.chart.create.title')"
		class="w-full max-w-3xl"
		@update:visible="emit('update:visible', $event)"
	>
		<div v-if="loading" class="flex items-center gap-2 py-6 text-sm text-surface-500">
			<i class="pi pi-spin pi-spinner" /> {{ $t('admin.carga.ml.chart.create.loading') }}
		</div>

		<div v-else-if="template" class="flex flex-col gap-4 pt-1">
			<!-- Para qué producto es la guía: lo define la categoría de ML (no se elige acá:
			     ML rechaza guías de otro tipo de producto). -->
			<div class="flex items-center gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
				<MlMeasureIllustration :kind="kind" :label="$t(`admin.carga.ml.chart.create.product.${kind}`)" class="h-12 w-16 shrink-0" />
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold">{{ $t('admin.carga.ml.chart.create.context.for', { category: categoryName || $t(`admin.carga.ml.chart.create.product.${kind}`) }) }}</p>
					<p class="truncate text-xs text-surface-500">{{ [gender, brand].filter(Boolean).join(' · ') }}</p>
					<button type="button" class="mt-0.5 text-left text-[11px] text-primary underline underline-offset-2" @click="emit('update:visible', false)">
						{{ $t('admin.carga.ml.chart.create.context.change') }}
					</button>
				</div>
			</div>

			<!-- Pasos: número + nombre (en el celular, el nombre solo en el paso actual). -->
			<ol class="flex items-center gap-2 text-xs">
				<li v-for="(s, i) in stepKeys" :key="s" class="flex items-center gap-1.5" :class="i === step ? 'font-semibold text-primary' : 'text-surface-500'">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
						:class="i < step ? 'border-emerald-500 bg-emerald-500 text-white' : i === step ? 'border-primary bg-primary text-white' : 'border-surface-300 dark:border-surface-600'"
					>
						<i v-if="i < step" class="pi pi-check text-[10px]" />
						<template v-else>{{ i + 1 }}</template>
					</span>
					<span :class="i === step ? '' : 'hidden sm:inline'">{{ $t(`admin.carga.ml.chart.create.steps.${s}`) }}</span>
					<span v-if="i < stepKeys.length - 1" class="mx-1 h-px w-4 bg-surface-300 dark:bg-surface-600 sm:w-8" />
				</li>
			</ol>

			<!-- ── 1. Tipo de talle (y, en ropa, tipo de medidas) ── -->
			<template v-if="step === 0">
				<div class="space-y-2">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.typeTitle') }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.typeHint') }}</p>
					<div class="grid gap-2 sm:grid-cols-2">
						<button
							v-for="col in shownMainColumns"
							:key="col.id"
							type="button"
							class="rounded-xl border p-3 text-left transition-colors"
							:class="mainId === col.id ? 'border-primary bg-primary/5' : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'"
							@click="mainId = col.id"
						>
							<span class="flex items-center gap-2 text-sm font-semibold">
								<i class="pi" :class="mainId === col.id ? 'pi-check-circle text-primary' : 'pi-circle text-surface-400'" />
								{{ friendly(col).title }}
							</span>
							<span class="mt-1 block text-xs text-surface-500">{{ friendly(col).example }}</span>
						</button>
					</div>
					<button
						v-if="otherMainColumns.length"
						type="button"
						class="text-xs text-primary underline underline-offset-2"
						@click="showOtherSystems = !showOtherSystems"
					>
						{{ $t(showOtherSystems ? 'admin.carga.ml.chart.create.fewerSystems' : 'admin.carga.ml.chart.create.otherSystems', { list: otherMainColumns.map(c => c.name).join(', ') }) }}
					</button>
				</div>

				<div v-if="template.clothingMeasures" class="space-y-2">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.measureTypeTitle') }}</p>
					<div class="grid gap-2 sm:grid-cols-2">
						<button
							v-for="m in measureTypes"
							:key="m.value"
							type="button"
							class="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors"
							:class="measureType === m.value ? 'border-primary bg-primary/5' : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'"
							@click="measureType = m.value"
						>
							<MlMeasureIllustration :kind="m.illustration" :label="$t(m.label)" class="h-12 w-16 shrink-0" />
							<span>
								<span class="flex items-center gap-2 text-sm font-semibold">
									<i class="pi" :class="measureType === m.value ? 'pi-check-circle text-primary' : 'pi-circle text-surface-400'" />
									{{ $t(m.label) }}
								</span>
								<span class="mt-1 block text-xs text-surface-500">{{ $t(m.desc) }}</span>
							</span>
						</button>
					</div>
				</div>
			</template>

			<!-- ── 2. Talles: la lista que el comprador ve al elegir ── -->
			<template v-else-if="step === 1">
				<div class="space-y-1">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.sizesTitle', { type: mainColumn ? friendly(mainColumn).title : '' }) }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.sizesHint') }}</p>
				</div>

				<div
					class="flex min-h-[3rem] flex-wrap gap-2 rounded-xl border p-2"
					:class="showErrors && !sizes.length ? 'border-red-400' : 'border-surface-200 dark:border-surface-700'"
				>
					<span v-for="(s, i) in sizes" :key="s" class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary">
						{{ displaySize(s) }}
						<button
							type="button"
							class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary/20"
							:aria-label="$t('admin.carga.ml.chart.create.removeSize', { size: displaySize(s) })"
							@click="sizes.splice(i, 1)"
						>
							<i class="pi pi-times text-xs" />
						</button>
					</span>
					<span v-if="!sizes.length" class="self-center px-1 text-xs text-surface-400">{{ $t('admin.carga.ml.chart.create.sizesEmpty') }}</span>
				</div>

				<!-- Agregar: de la lista de ML si la columna la tiene, si no escribiendo. -->
				<div class="flex gap-2">
					<Select
						v-if="mainColumn?.values.length"
						v-model="sizeInput"
						:options="mainColumn.values.filter(v => !sizes.includes(v.name)).map(v => v.name)"
						filter
						:placeholder="$t('admin.carga.ml.chart.create.sizePick')"
						class="w-full min-w-0"
						@update:model-value="addSize"
					/>
					<template v-else>
						<InputText v-model="sizeInput" class="w-full min-w-0" :placeholder="sizePlaceholder" @keyup.enter="addSize()" />
						<Button :label="$t('admin.carga.ml.chart.create.sizeAdd')" icon="pi pi-plus" outlined class="shrink-0" @click="addSize()" />
					</template>
				</div>
				<p v-if="sizeError" class="text-xs text-red-500">{{ sizeError }}</p>

				<!-- Atajo para ropa con letras. -->
				<div v-if="isTextColumn(mainColumn)" class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.sizeQuick') }}</span>
					<button
						v-for="l in LETTER_SIZES.filter(l => !sizes.includes(l))"
						:key="l"
						type="button"
						class="min-h-[2.5rem] min-w-[2.5rem] rounded-lg border border-surface-200 px-2 text-sm font-medium text-primary hover:bg-primary/5 dark:border-surface-700"
						@click="addSize(l)"
					>
						{{ l }}
					</button>
				</div>
			</template>

			<!-- ── 3. Medidas de cada talle ── -->
			<template v-else>
				<div class="space-y-1">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.measuresTitle') }}</p>
					<p class="text-xs text-surface-500">
						{{ $t(measureColumns.length ? 'admin.carga.ml.chart.create.measuresHint' : 'admin.carga.ml.chart.create.measuresNone') }}
					</p>
				</div>

				<!-- Cómo medir: un dibujo por medida, con la línea a medir resaltada. -->
				<div v-if="measureColumns.length" class="grid gap-2 sm:grid-cols-2">
					<div v-for="col in measureColumns" :key="col.id" class="flex items-center gap-3 rounded-xl bg-surface-50 p-2.5 dark:bg-surface-800">
						<MlMeasureIllustration :kind="measureKind(col.id)" :label="$t('admin.carga.ml.chart.create.howToMeasure', { measure: col.name })" class="h-14 w-20 shrink-0" />
						<div class="min-w-0">
							<p class="text-sm font-semibold">{{ col.name }}</p>
							<p class="text-xs leading-snug text-surface-500">{{ $t(`admin.carga.ml.chart.create.measureHow.${measureKind(col.id)}`) }}</p>
						</div>
					</div>
				</div>

				<!-- Datos generales que pida la guía (además de género y marca). -->
				<div v-if="template.general.length" class="grid gap-3 sm:grid-cols-2">
					<div v-for="col in template.general" :key="col.id" class="space-y-1">
						<label class="text-sm font-medium">{{ col.name }} *</label>
						<InputText v-if="!col.values.length" v-model="general[col.id].text" class="w-full" :invalid="isMissing(col, general[col.id])" />
						<Select v-else v-model="general[col.id].ids[0]" :options="col.values" option-label="name" option-value="id" filter class="w-full" :invalid="isMissing(col, general[col.id])" />
					</div>
				</div>

				<template v-if="shownColumns.length">
					<!-- Celular: una tarjeta por talle, con sus medidas una debajo de otra. -->
					<div class="space-y-2 sm:hidden">
						<div v-for="s in sizes" :key="s" class="rounded-xl border border-surface-200 p-3 dark:border-surface-700">
							<p class="mb-2 text-sm font-semibold">{{ $t('admin.carga.ml.chart.create.sizeCard', { size: displaySize(s) }) }}</p>
							<div class="space-y-2">
								<div v-for="col in shownColumns" :key="col.id" class="space-y-1">
									<label class="text-xs text-surface-500">{{ col.name }}<span v-if="col.required"> *</span></label>
									<CellInput :col="col" :cell="rows[s][col.id]" :invalid="isMissing(col, rows[s][col.id])" />
								</div>
							</div>
						</div>
					</div>

					<!-- Escritorio: tabla, una fila por talle. -->
					<div class="hidden overflow-x-auto rounded border border-surface-200 dark:border-surface-700 sm:block">
						<table class="w-full text-sm">
							<thead class="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
								<tr>
									<th class="whitespace-nowrap px-2 py-1.5 font-medium">{{ mainColumn ? friendly(mainColumn).title : '' }}</th>
									<th v-for="col in shownColumns" :key="col.id" class="px-2 py-1.5 font-medium">
										{{ col.name }}<span v-if="col.required"> *</span>
									</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="s in sizes" :key="s" class="border-t border-surface-200 dark:border-surface-700">
									<td class="whitespace-nowrap px-2 py-1.5 align-middle font-semibold">{{ displaySize(s) }}</td>
									<td v-for="col in shownColumns" :key="col.id" class="min-w-[8rem] px-2 py-1.5 align-top">
										<CellInput :col="col" :cell="rows[s][col.id]" :invalid="isMissing(col, rows[s][col.id])" small />
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</template>

				<div class="grid gap-3 sm:grid-cols-2">
					<MultiSelect
						v-if="optionalColumns.length"
						v-model="extraIds"
						:options="optionalColumns"
						option-label="name"
						option-value="id"
						:placeholder="$t('admin.carga.ml.chart.create.extraColumns')"
						class="w-full"
					/>
					<div class="space-y-1 sm:col-start-2">
						<label class="text-xs font-medium">{{ $t('admin.carga.ml.chart.create.name') }}</label>
						<InputText v-model="name" maxlength="60" class="w-full" :invalid="showErrors && !name.trim()" />
					</div>
				</div>
			</template>
		</div>

		<!-- Lo que ML rechazó, celda por celda (columna + talle), explicado. -->
		<div v-if="serverErrors.length" class="mt-3 space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
			<p class="font-semibold">{{ $t('admin.carga.ml.chart.create.mlRejected') }}</p>
			<p v-for="(e, i) in serverErrors" :key="i">· {{ explain(e) }}</p>
		</div>
		<p v-else-if="error" class="pt-2 text-xs text-red-500">{{ error }}</p>

		<template #footer>
			<div class="flex w-full flex-col gap-2">
				<!-- Qué falta, a la vista junto a los botones (no al fondo del contenido). -->
				<p v-if="showErrors && stepMessage" class="flex items-start gap-1.5 text-xs text-red-500">
					<i class="pi pi-exclamation-circle mt-px" /> {{ stepMessage }}
				</p>
				<div class="flex justify-end gap-2">
					<Button
						:label="$t(step === 0 ? 'admin.carga.ml.chart.create.cancel' : 'admin.carga.ml.chart.create.back')"
						text
						severity="secondary"
						@click="step === 0 ? emit('update:visible', false) : back()"
					/>
					<Button v-if="step < 2" :label="$t('admin.carga.ml.chart.create.next')" icon="pi pi-arrow-right" icon-pos="right" :disabled="!template" @click="next" />
					<Button v-else :label="$t('admin.carga.ml.chart.create.submit')" icon="pi pi-check" :loading="saving" @click="submit" />
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, reactive, ref, resolveComponent, watch, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AxiosError } from 'axios';
import type {
	MlSizeChart,
	MlSizeChartCellInput,
	MlSizeChartColumn,
	MlSizeChartError,
	MlSizeChartMeasureType,
	MlSizeChartTemplate,
	MlSizeChartValueInput,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { measureExample, measureKind, productKind, type MeasureKind } from '@/modules/admin/utils/sizeChartMeasures';
import MlMeasureIllustration from '@/modules/admin/components/MlMeasureIllustration.vue';

/**
 * Crea una guía de talles propia (SPECIFIC) en Mercado Libre, con los mismos pasos
 * que ML: tipo de talle → lista de talles → medidas de cada talle. Las columnas
 * salen de la ficha técnica de la guía del dominio (qué talles y medidas pide ML).
 */
const props = defineProps<{
	visible: boolean;
	rubroId: string;
	categoryId: string;
	/** Nombre de la categoría de ML (ej. "Zapatillas"), para el encabezado. */
	categoryName?: string;
	gender: string;
	brand: string;
	/** Talles del producto (ej. ["36", "37"] o ["S", "M"]): arrancan como la lista de talles. */
	sizes?: string[];
}>();
const emit = defineEmits<{ 'update:visible': [boolean]; created: [MlSizeChart] }>();

const { t } = useI18n();
const catalog = useCatalogStore();

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const stepKeys = ['type', 'sizes', 'measures'] as const;
const measureTypes: { value: MlSizeChartMeasureType; label: string; desc: string; illustration: MeasureKind }[] = [
	{ value: 'BODY_MEASURE', label: 'admin.carga.ml.chart.create.measureBody', desc: 'admin.carga.ml.chart.create.measureBodyDesc', illustration: 'chest' },
	{ value: 'CLOTHING_MEASURE', label: 'admin.carga.ml.chart.create.measureClothing', desc: 'admin.carga.ml.chart.create.measureClothingDesc', illustration: 'garmentWidth' },
];
/** Sistemas de talle que se muestran de entrada; el resto (US, EU, UK…) va en "Otros sistemas". */
const COMMON_SYSTEMS = ['AR_SIZE', 'SIZE', 'MANUFACTURER_SIZE'];

/** Lo cargado en una celda: texto, número (+ unidad) u opciones de lista. */
interface Cell {
	text: string;
	number: number | null;
	unit: string;
	ids: string[];
}
type Row = Record<string, Cell>;

/** Campo de una celda según el tipo de columna (número + unidad, lista, texto). */
const CellInput = defineComponent({
	props: {
		col: { type: Object as PropType<MlSizeChartColumn>, required: true },
		cell: { type: Object as PropType<Cell>, required: true },
		invalid: Boolean,
		small: Boolean,
	},
	setup(p) {
		const InputNumber = resolveComponent('InputNumber');
		const Select = resolveComponent('Select');
		const MultiSelect = resolveComponent('MultiSelect');
		const InputText = resolveComponent('InputText');
		return () => {
			const { col, cell, invalid } = p;
			const size = p.small ? 'small' : undefined;
			if (col.valueType === 'number' || col.valueType === 'number_unit') {
				return h('div', { class: 'flex gap-1' }, [
					h(InputNumber, {
						modelValue: cell.number,
						'onUpdate:modelValue': (v: number | null) => (cell.number = v),
						minFractionDigits: 0,
						maxFractionDigits: 2,
						locale: 'es-AR',
						// Con una sola unidad va dentro del campo: "23,5 cm".
						suffix: col.units.length === 1 ? ` ${col.units[0]}` : undefined,
						// Columna de talle (US, EU…): "Talle en US"; medida: un valor realista ("Ej.: 92").
						placeholder: col.mainCandidate
							? t('admin.carga.ml.chart.create.sizeColumnPlaceholder', { unit: col.units[0] ?? col.name })
							: t('admin.carga.ml.chart.create.measurePlaceholder', { example: measureExample(col.id) }),
						invalid,
						size,
						fluid: true,
						class: 'min-w-0 flex-1',
					}),
					col.units.length > 1
						? h(Select, { modelValue: cell.unit, 'onUpdate:modelValue': (v: string) => (cell.unit = v), options: col.units, size, class: 'w-24 shrink-0' })
						: null,
				]);
			}
			if (col.values.length && col.multivalued) {
				return h(MultiSelect, { modelValue: cell.ids, 'onUpdate:modelValue': (v: string[]) => (cell.ids = v), options: col.values, optionLabel: 'name', optionValue: 'id', filter: true, invalid, size, class: 'w-full' });
			}
			if (col.values.length) {
				return h(Select, { modelValue: cell.ids[0], 'onUpdate:modelValue': (v: string) => (cell.ids = v ? [v] : []), options: col.values, optionLabel: 'name', optionValue: 'id', filter: true, invalid, size, class: 'w-full' });
			}
			return h(InputText, { modelValue: cell.text, 'onUpdate:modelValue': (v: string) => (cell.text = v), invalid, size, class: 'w-full' });
		};
	},
});

const template = ref<MlSizeChartTemplate | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
/** Celdas que ML rechazó al crear la guía (se explican y se marcan en rojo). */
const serverErrors = ref<MlSizeChartError[]>([]);
const step = ref(0);
const showErrors = ref(false);
const showOtherSystems = ref(false);
const mainId = ref('');
const measureType = ref<MlSizeChartMeasureType>('BODY_MEASURE');
const sizes = ref<string[]>([]);
const sizeInput = ref('');
const sizeError = ref('');
const name = ref('');
const extraIds = ref<string[]>([]);
const general = reactive<Record<string, Cell>>({});
/** Una fila por talle (clave = el talle). */
const rows = reactive<Record<string, Row>>({});

function isNumberColumn(col?: MlSizeChartColumn): boolean {
	return col?.valueType === 'number' || col?.valueType === 'number_unit';
}
function isTextColumn(col?: MlSizeChartColumn): boolean {
	return !!col && !isNumberColumn(col) && !col.values.length;
}

/** Tipo de producto (calzado, remera, pantalón) para el dibujo del encabezado. */
const kind = computed(() => productKind(template.value?.domainId ?? '', (template.value?.columns ?? []).map(c => c.id)));

const mainColumns = computed(() => (template.value?.columns ?? []).filter(c => c.mainCandidate));
const mainColumn = computed(() => template.value?.columns.find(c => c.id === mainId.value));
/** Talle del país del sitio (AR_SIZE en MLA) también cuenta como común. */
function isCommon(col: MlSizeChartColumn): boolean {
	return COMMON_SYSTEMS.includes(col.id) || col.id === template.value?.suggestedMainId;
}
const otherMainColumns = computed(() => mainColumns.value.filter(c => !isCommon(c)));
const shownMainColumns = computed(() =>
	mainColumns.value.filter(c => isCommon(c) || showOtherSystems.value || c.id === mainId.value),
);

/** Nombre simple y ejemplo de un sistema de talle (en vez del nombre técnico de ML). */
function friendly(col: MlSizeChartColumn): { title: string; example: string } {
	const base = 'admin.carga.ml.chart.create.system';
	if (col.id === 'AR_SIZE') return { title: t(`${base}.ar`), example: t(`${base}.arExample`) };
	if (col.id === 'MANUFACTURER_SIZE') return { title: t(`${base}.brand`), example: t(`${base}.brandExample`) };
	if (col.id === 'SIZE' && isTextColumn(col)) return { title: t(`${base}.letters`), example: t(`${base}.lettersExample`) };
	if (col.values.length) return { title: col.name, example: t(`${base}.listExample`, { examples: col.values.slice(0, 4).map(v => v.name).join(', ') }) };
	if (isNumberColumn(col)) return { title: col.name, example: t(`${base}.numberExample`, { unit: col.units[0] ?? col.name }) };
	return { title: col.name, example: t(`${base}.textExample`) };
}

/** ¿La columna va con el tipo de medidas elegido? (en calzado ML no distingue: van todas). */
function matchesMeasure(col: MlSizeChartColumn): boolean {
	if (!template.value?.clothingMeasures || !col.measure) return true;
	return col.measure === (measureType.value === 'CLOTHING_MEASURE' ? 'CLOTHING' : 'BODY');
}

/** Columnas de cada fila que se mandan: obligatorias (sin el talle principal) y las que sumó el vendedor. */
const tableColumns = computed(() =>
	(template.value?.columns ?? []).filter(
		c => c.id !== mainId.value && matchesMeasure(c) && (c.required || extraIds.value.includes(c.id)),
	),
);
const measureColumns = computed(() => tableColumns.value.filter(c => c.isMeasure));
/**
 * Columnas que se muestran: las listas técnicas de ML (ej. "Talle filtrable") se
 * esconden si ya se completaron solas en todos los talles; se mandan igual.
 */
const shownColumns = computed(() =>
	tableColumns.value.filter(c => !(c.values.length && !c.isMeasure && sizes.value.every(s => filled(c, rows[s]?.[c.id])) && autoFilled.value.has(c.id))),
);
/** Columnas que arrancaron completas solas (para esconderlas mientras sigan así). */
const autoFilled = ref(new Set<string>());
/** Columnas opcionales que se pueden sumar (otras medidas, otros sistemas de talle). */
const optionalColumns = computed(() =>
	(template.value?.columns ?? []).filter(c => c.id !== mainId.value && !c.required && matchesMeasure(c)),
);

const sizePlaceholder = computed(() =>
	isNumberColumn(mainColumn.value) ? t('admin.carga.ml.chart.create.sizePlaceholderNumber') : t('admin.carga.ml.chart.create.sizePlaceholderText'),
);

/** Cómo se ve el talle: con su unidad si la columna la tiene ("36 AR"). */
function displaySize(s: string): string {
	const col = mainColumn.value;
	return isNumberColumn(col) && col?.units.length === 1 ? `${s} ${col.units[0]}` : s;
}

function parseNumber(s: string): number | null {
	const n = Number(s.trim().replace(',', '.'));
	return s.trim() && Number.isFinite(n) ? n : null;
}

/**
 * Ordena los talles como los va a ver el comprador: números de menor a mayor,
 * letras de XXS a XXXL. Lo que no sea ni una cosa ni la otra queda como se cargó.
 */
function sortSizes(list: string[]): string[] {
	if (list.every(s => parseNumber(s) != null)) return [...list].sort((a, b) => parseNumber(a)! - parseNumber(b)!);
	const rank = (s: string) => {
		const i = LETTER_SIZES.indexOf(s.toUpperCase());
		return i === -1 ? Number.MAX_SAFE_INTEGER : i;
	};
	return list.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(x => x.s);
}

function addSize(value?: string | null) {
	const s = (value ?? sizeInput.value ?? '').trim();
	sizeError.value = '';
	if (!s) return;
	if (isNumberColumn(mainColumn.value) && parseNumber(s) == null) {
		sizeError.value = t('admin.carga.ml.chart.create.sizeNotNumber', { size: s, type: mainColumn.value ? friendly(mainColumn.value).title : '' });
		return;
	}
	if (!sizes.value.includes(s)) sizes.value = sortSizes([...sizes.value, s]);
	sizeInput.value = '';
}

function emptyCell(col: MlSizeChartColumn): Cell {
	return { text: '', number: null, unit: col.defaultUnit ?? col.units[0] ?? '', ids: [] };
}

function filled(col: MlSizeChartColumn, cell?: Cell): boolean {
	if (!cell) return false;
	if (col.valueType === 'number_unit') return cell.number != null && !!cell.unit;
	if (col.valueType === 'number') return cell.number != null;
	if (col.values.length) return cell.ids.some(Boolean);
	return !!cell.text.trim();
}

/** ¿Hay que marcar esta celda en rojo? (obligatoria y vacía, o rechazada por ML). */
function isMissing(col: MlSizeChartColumn, cell?: Cell): boolean {
	if (showErrors.value && col.required && !filled(col, cell)) return true;
	const s = cell ? Object.keys(rows).find(k => rows[k][col.id] === cell) : undefined;
	return serverErrors.value.some(e => e.attributeId === col.id && (!e.row || (s != null && sameSize(e.row, s))));
}

/** ¿El talle que informa ML ("37 AR") es este talle de la lista ("37")? */
function sameSize(mlRow: string, size: string): boolean {
	const a = mlRow.trim().toLowerCase();
	return a === size.toLowerCase() || a === displaySize(size).toLowerCase() || parseNumber(a.split(' ')[0]) === parseNumber(size);
}

/** Nombre de una columna para mostrar (el de la ficha de ML, o el id si no está). */
function columnName(id: string | null): string {
	if (!id) return '';
	const col = template.value?.columns.find(c => c.id === id) ?? template.value?.general.find(c => c.id === id);
	return col ? (col.mainCandidate ? friendly(col).title : col.name) : id;
}

/** Error de ML explicado en castellano, con la columna y el talle. */
function explain(e: MlSizeChartError): string {
	const base = 'admin.carga.ml.chart.create.mlError';
	const params = { attr: columnName(e.attributeId), row: e.row ?? '' };
	const range = /range:\s*([\d.,]+)\s*-\s*([\d.,]+)/i.exec(e.message);
	switch (e.code) {
		case 'required_row_attribute_not_found':
			return t(`${base}.required`, params);
		case 'value_out_of_range':
			return range ? t(`${base}.range`, { ...params, min: range[1], max: range[2] }) : t(`${base}.rangeNoLimits`, params);
		case 'invalid_row_attribute_value':
		case 'value_is_not_in_the_list':
			return t(`${base}.invalidValue`, params);
		case 'duplicated_measure_value':
			return t(`${base}.duplicated`, params);
		case 'invalid_attribute_value':
			return t(`${base}.notSize`, params);
		case 'invalid_row_attribute':
			return t(`${base}.wrongMeasureType`, params);
		case 'invalid_main_attribute_id':
			return t(`${base}.invalidMain`, params);
		case 'value_is_not_the_same_type':
			return t(`${base}.mixedTypes`, params);
		default:
			return e.message;
	}
}

/**
 * Asegura una fila (con todas las columnas) por cada talle de la lista. Las listas
 * de ML que traen el mismo talle (ej. "Talle filtrable": S → S) arrancan elegidas.
 */
function syncRows() {
	for (const s of sizes.value) {
		const row = rows[s] ?? (rows[s] = {});
		for (const col of template.value?.columns ?? []) {
			if (row[col.id]) continue;
			const cell = emptyCell(col);
			const same = col.values.find(v => v.name.trim().toLowerCase() === s.toLowerCase());
			if (same && col.id !== mainId.value) cell.ids = [same.id];
			row[col.id] = cell;
		}
	}
	// Las listas que quedaron completas en todos los talles no hace falta mostrarlas.
	autoFilled.value = new Set(
		tableColumns.value.filter(c => c.values.length && !c.isMeasure && sizes.value.every(s => filled(c, rows[s]?.[c.id]))).map(c => c.id),
	);
}

/** Qué falta para avanzar en el paso actual (vacío = se puede). */
const stepMessage = computed(() => {
	if (!template.value) return '';
	if (step.value === 0) return mainId.value ? '' : t('admin.carga.ml.chart.create.needType');
	if (step.value === 1) {
		if (!sizes.value.length) return t('admin.carga.ml.chart.create.needSizes');
		// Ej.: eligió "AR" (números) pero la lista trae "S": ML lo rechazaría.
		const bad = isNumberColumn(mainColumn.value) ? sizes.value.find(s => parseNumber(s) == null) : undefined;
		if (bad) return t('admin.carga.ml.chart.create.sizeInvalidNumber', { size: bad });
		if (sizes.value.length > template.value.maxRows) return t('admin.carga.ml.chart.create.maxRows', { max: template.value.maxRows });
		return '';
	}
	if (template.value.general.some(c => !filled(c, general[c.id]))) return t('admin.carga.ml.chart.create.missing');
	const required = tableColumns.value.filter(c => c.required);
	if (sizes.value.some(s => required.some(c => !filled(c, rows[s]?.[c.id])))) return t('admin.carga.ml.chart.create.missing');
	if (!name.value.trim()) return t('admin.carga.ml.chart.create.needName');
	return '';
});

/** Si falta algo: lo marca en rojo y lleva la vista al primer campo marcado. */
function blockIfIncomplete(): boolean {
	if (!stepMessage.value) return false;
	showErrors.value = true;
	void nextTick(() => document.querySelector('.p-dialog .p-invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
	return true;
}

function next() {
	if (blockIfIncomplete()) return;
	showErrors.value = false;
	if (step.value === 1) syncRows();
	step.value++;
}

function back() {
	showErrors.value = false;
	step.value--;
}

function toValues(col: MlSizeChartColumn, cell: Cell): MlSizeChartValueInput[] {
	if (!filled(col, cell)) return [];
	if (col.valueType === 'number_unit') return [{ number: cell.number!, unit: cell.unit }];
	if (col.valueType === 'number') return [{ name: String(cell.number) }];
	if (col.values.length) return cell.ids.filter(Boolean).map(id => ({ id, name: col.values.find(v => v.id === id)?.name }));
	return [{ name: cell.text.trim() }];
}

function toCells(cols: MlSizeChartColumn[], source: Row): MlSizeChartCellInput[] {
	return cols.map(c => ({ id: c.id, values: toValues(c, source[c.id]) })).filter(c => c.values.length);
}

/** El talle de la fila en su columna principal: opción de la lista, número + unidad o texto. */
function mainCell(size: string): MlSizeChartCellInput {
	const col = mainColumn.value!;
	if (col.values.length) {
		const v = col.values.find(x => x.name === size);
		return { id: col.id, values: [v ? { id: v.id, name: v.name } : { name: size }] };
	}
	if (col.valueType === 'number_unit') return { id: col.id, values: [{ number: parseNumber(size)!, unit: col.defaultUnit ?? col.units[0] ?? '' }] };
	return { id: col.id, values: [{ name: size }] };
}

/** Talle principal sugerido según los talles del producto: números → AR (o el del país), letras → texto. */
function guessMain(tpl: MlSizeChartTemplate): string {
	const cands = tpl.columns.filter(c => c.mainCandidate);
	const product = (props.sizes ?? []).map(s => s.trim()).filter(Boolean);
	const numeric = product.length > 0 && product.every(s => parseNumber(s) != null);
	if (product.length && !numeric) {
		const lower = product.map(s => s.toLowerCase());
		const byList = cands.find(c => c.values.length && lower.every(s => c.values.some(v => v.name.toLowerCase() === s)));
		const text = cands.find(c => c.id === 'SIZE' && isTextColumn(c)) ?? cands.find(c => isTextColumn(c));
		if (byList || text) return (byList ?? text)!.id;
	}
	return tpl.suggestedMainId ?? cands[0]?.id ?? '';
}

/** Nombre sugerido: solo letras, números y espacios (lo exige ML). */
function suggestedName(): string {
	const base = `${t('admin.carga.ml.chart.create.defaultName')} ${props.categoryName ?? ''} ${props.gender} ${props.brand}`;
	return base.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

async function load() {
	loading.value = true;
	error.value = '';
	template.value = null;
	try {
		const tpl = await catalog.fetchMlSizeChartTemplate(props.rubroId, props.categoryId, props.gender, props.brand);
		template.value = tpl;
		step.value = 0;
		showErrors.value = false;
		serverErrors.value = [];
		mainId.value = guessMain(tpl);
		showOtherSystems.value = false;
		measureType.value = 'BODY_MEASURE';
		extraIds.value = [];
		sizes.value = sortSizes([...new Set((props.sizes ?? []).map(s => s.trim()).filter(Boolean))]);
		sizeInput.value = '';
		sizeError.value = '';
		autoFilled.value = new Set();
		for (const key of Object.keys(general)) delete general[key];
		for (const col of tpl.general) general[col.id] = emptyCell(col);
		for (const key of Object.keys(rows)) delete rows[key];
		name.value = suggestedName();
	} catch (err) {
		error.value = apiErrorMessage(err, t('admin.carga.ml.chart.create.templateError'));
	} finally {
		loading.value = false;
	}
}

async function submit() {
	if (!template.value || !mainColumn.value) return;
	syncRows();
	if (blockIfIncomplete()) return;
	saving.value = true;
	error.value = '';
	serverErrors.value = [];
	try {
		const created = await catalog.createMlSizeChart(props.rubroId, props.categoryId, {
			name: name.value.trim(),
			gender: props.gender,
			brand: props.brand || undefined,
			mainAttributeId: mainId.value,
			...(template.value.clothingMeasures ? { measureType: measureType.value } : {}),
			attributes: toCells(template.value.general, general),
			rows: sizes.value.map(s => ({ attributes: [mainCell(s), ...toCells(tableColumns.value, rows[s])] })),
		});
		emit('created', created);
		emit('update:visible', false);
	} catch (err) {
		error.value = apiErrorMessage(err, t('admin.carga.ml.chart.create.error'));
		// ML detalla qué celdas rechazó: se explican y se marcan en rojo.
		serverErrors.value = (err as AxiosError<{ errors?: MlSizeChartError[] }>)?.response?.data?.errors ?? [];
		// Si ML pide una columna que no estaba a la vista (la ficha no la marcaba
		// obligatoria), la sumamos para que se pueda completar.
		for (const e of serverErrors.value) {
			const col = template.value?.columns.find(c => c.id === e.attributeId);
			if (col && col.id !== mainId.value && !tableColumns.value.includes(col) && !extraIds.value.includes(col.id)) extraIds.value.push(col.id);
		}
		autoFilled.value = new Set([...autoFilled.value].filter(id => !serverErrors.value.some(e => e.attributeId === id)));
		if (serverErrors.value.length) void nextTick(() => document.querySelector('.p-dialog .p-invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
	} finally {
		saving.value = false;
	}
}

// Cada vez que se abre, volvemos a pedir la ficha (puede cambiar género / marca / categoría).
watch(
	() => props.visible,
	open => {
		if (open) void load();
	},
	{ immediate: true },
);
</script>
