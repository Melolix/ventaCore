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
			<!-- Pasos, como en Mercado Libre: tipo de talle → talles → medidas. -->
			<ol class="flex gap-2 text-xs">
				<li
					v-for="(s, i) in stepKeys"
					:key="s"
					class="flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5"
					:class="i === step ? 'border-primary bg-primary/5 font-semibold text-primary' : i < step ? 'border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-300' : 'border-surface-200 text-surface-400 dark:border-surface-700'"
				>
					<i class="pi text-[10px]" :class="i < step ? 'pi-check-circle text-emerald-500' : 'pi-circle'" />
					{{ $t(`admin.carga.ml.chart.create.steps.${s}`) }}
				</li>
			</ol>

			<!-- ── 1. Tipo de talle (y, en ropa, tipo de medidas) ── -->
			<template v-if="step === 0">
				<div class="space-y-2">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.typeTitle') }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.typeHint') }}</p>
					<div class="grid gap-2 sm:grid-cols-2">
						<button
							v-for="col in mainColumns"
							:key="col.id"
							type="button"
							class="rounded-xl border p-3 text-left transition-colors"
							:class="mainId === col.id ? 'border-primary bg-primary/5' : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'"
							@click="mainId = col.id"
						>
							<span class="flex items-center gap-2 text-sm font-semibold">
								<i class="pi" :class="mainId === col.id ? 'pi-check-circle text-primary' : 'pi-circle text-surface-400'" />
								{{ col.name }}
							</span>
							<span class="mt-1 block text-xs text-surface-500">{{ example(col) }}</span>
						</button>
					</div>
				</div>

				<div v-if="template.clothingMeasures" class="space-y-2">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.measureTypeTitle') }}</p>
					<div class="grid gap-2 sm:grid-cols-2">
						<button
							v-for="m in measureTypes"
							:key="m.value"
							type="button"
							class="rounded-xl border p-3 text-left transition-colors"
							:class="measureType === m.value ? 'border-primary bg-primary/5' : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'"
							@click="measureType = m.value"
						>
							<span class="flex items-center gap-2 text-sm font-semibold">
								<i class="pi" :class="measureType === m.value ? 'pi-check-circle text-primary' : 'pi-circle text-surface-400'" />
								{{ $t(m.label) }}
							</span>
							<span class="mt-1 block text-xs text-surface-500">{{ $t(m.desc) }}</span>
						</button>
					</div>
				</div>
			</template>

			<!-- ── 2. Talles: la lista que el comprador ve al elegir ── -->
			<template v-else-if="step === 1">
				<div class="space-y-1">
					<p class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.sizesTitle', { type: mainColumn?.name ?? '' }) }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.sizesHint') }}</p>
				</div>

				<div class="flex min-h-[2.75rem] flex-wrap gap-2 rounded-xl border border-surface-200 p-2 dark:border-surface-700">
					<span v-for="(s, i) in sizes" :key="s" class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary">
						{{ displaySize(s) }}
						<button type="button" class="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20" :title="$t('admin.carga.ml.chart.create.removeSize')" @click="sizes.splice(i, 1)">
							<i class="pi pi-times text-[10px]" />
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
						<Button :label="$t('admin.carga.ml.chart.create.sizeAdd')" icon="pi pi-plus" size="small" outlined class="shrink-0" @click="addSize()" />
					</template>
				</div>
				<p v-if="sizeError" class="text-xs text-red-500">{{ sizeError }}</p>

				<!-- Atajo para ropa con letras. -->
				<div v-if="isTextColumn(mainColumn)" class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.sizeQuick') }}</span>
					<Button
						v-for="l in LETTER_SIZES.filter(l => !sizes.includes(l))"
						:key="l"
						:label="l"
						size="small"
						text
						class="!px-2 !py-0.5"
						@click="addSize(l)"
					/>
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

				<!-- Datos generales que pida la guía (además de género y marca). -->
				<div v-if="template.general.length" class="grid gap-3 sm:grid-cols-2">
					<div v-for="col in template.general" :key="col.id" class="space-y-1">
						<label class="text-sm font-medium">{{ col.name }} *</label>
						<InputText v-if="!col.values.length" v-model="general[col.id].text" class="w-full" />
						<Select v-else v-model="general[col.id].ids[0]" :options="col.values" option-label="name" option-value="id" filter class="w-full" />
					</div>
				</div>

				<div v-if="tableColumns.length" class="overflow-x-auto rounded border border-surface-200 dark:border-surface-700">
					<table class="w-full text-sm">
						<thead class="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
							<tr>
								<th class="whitespace-nowrap px-2 py-1.5 font-medium">{{ mainColumn?.name }}</th>
								<th v-for="col in tableColumns" :key="col.id" class="whitespace-nowrap px-2 py-1.5 font-medium">
									{{ col.name }}<span v-if="col.required"> *</span>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="s in sizes" :key="s" class="border-t border-surface-200 dark:border-surface-700">
								<td class="whitespace-nowrap px-2 py-1.5 align-middle font-semibold">{{ displaySize(s) }}</td>
								<td v-for="col in tableColumns" :key="col.id" class="min-w-[8rem] px-2 py-1.5 align-top">
									<div v-if="isNumberColumn(col)" class="flex gap-1">
										<!-- Con una sola unidad va dentro del campo: "23,5 cm". -->
										<InputNumber
											v-model="rows[s][col.id].number"
											:min-fraction-digits="0"
											:max-fraction-digits="2"
											locale="es-AR"
											:suffix="col.units.length === 1 ? ` ${col.units[0]}` : undefined"
											:placeholder="$t('admin.carga.ml.chart.create.measurePlaceholder')"
											size="small"
											fluid
											class="min-w-0 flex-1"
										/>
										<Select v-if="col.units.length > 1" v-model="rows[s][col.id].unit" :options="col.units" size="small" class="w-20 shrink-0" />
									</div>
									<MultiSelect
										v-else-if="col.values.length && col.multivalued"
										v-model="rows[s][col.id].ids"
										:options="col.values"
										option-label="name"
										option-value="id"
										filter
										size="small"
										class="w-full"
									/>
									<Select
										v-else-if="col.values.length"
										v-model="rows[s][col.id].ids[0]"
										:options="col.values"
										option-label="name"
										option-value="id"
										filter
										size="small"
										class="w-full"
									/>
									<InputText v-else v-model="rows[s][col.id].text" size="small" class="w-full" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<MultiSelect
						v-if="optionalColumns.length"
						v-model="extraIds"
						:options="optionalColumns"
						option-label="name"
						option-value="id"
						:placeholder="$t('admin.carga.ml.chart.create.extraColumns')"
						size="small"
						class="w-full"
					/>
					<div class="space-y-1 sm:col-start-2">
						<label class="text-xs font-medium">{{ $t('admin.carga.ml.chart.create.name') }}</label>
						<InputText v-model="name" maxlength="60" size="small" class="w-full" />
					</div>
				</div>
			</template>

			<p v-if="stepMessage" class="text-xs text-amber-600 dark:text-amber-400">{{ stepMessage }}</p>
		</div>

		<p v-if="error" class="pt-2 text-xs text-red-500">{{ error }}</p>

		<template #footer>
			<Button
				:label="$t(step === 0 ? 'admin.carga.ml.chart.create.cancel' : 'admin.carga.ml.chart.create.back')"
				text
				severity="secondary"
				@click="step === 0 ? emit('update:visible', false) : step--"
			/>
			<Button v-if="step < 2" :label="$t('admin.carga.ml.chart.create.next')" icon="pi pi-arrow-right" icon-pos="right" :disabled="!template || !!stepMessage" @click="next" />
			<Button v-else :label="$t('admin.carga.ml.chart.create.submit')" icon="pi pi-check" :loading="saving" :disabled="!!stepMessage" @click="submit" />
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
	MlSizeChart,
	MlSizeChartCellInput,
	MlSizeChartColumn,
	MlSizeChartMeasureType,
	MlSizeChartTemplate,
	MlSizeChartValueInput,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

/**
 * Crea una guía de talles propia (SPECIFIC) en Mercado Libre, con los mismos pasos
 * que ML: tipo de talle → lista de talles → medidas de cada talle. Las columnas
 * salen de la ficha técnica de la guía del dominio (qué talles y medidas pide ML).
 */
const props = defineProps<{
	visible: boolean;
	rubroId: string;
	categoryId: string;
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
const measureTypes: { value: MlSizeChartMeasureType; label: string; desc: string }[] = [
	{ value: 'BODY_MEASURE', label: 'admin.carga.ml.chart.create.measureBody', desc: 'admin.carga.ml.chart.create.measureBodyDesc' },
	{ value: 'CLOTHING_MEASURE', label: 'admin.carga.ml.chart.create.measureClothing', desc: 'admin.carga.ml.chart.create.measureClothingDesc' },
];

/** Lo cargado en una celda: texto, número (+ unidad) u opciones de lista. */
interface Cell {
	text: string;
	number: number | null;
	unit: string;
	ids: string[];
}
type Row = Record<string, Cell>;

const template = ref<MlSizeChartTemplate | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const step = ref(0);
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

const mainColumns = computed(() => (template.value?.columns ?? []).filter(c => c.mainCandidate));
const mainColumn = computed(() => template.value?.columns.find(c => c.id === mainId.value));

/** ¿La columna va con el tipo de medidas elegido? (en calzado ML no distingue: van todas). */
function matchesMeasure(col: MlSizeChartColumn): boolean {
	if (!template.value?.clothingMeasures || !col.measure) return true;
	return col.measure === (measureType.value === 'CLOTHING_MEASURE' ? 'CLOTHING' : 'BODY');
}

/** Columnas de la tabla de medidas: las obligatorias (sin el talle principal) y las que sumó el vendedor. */
const tableColumns = computed(() =>
	(template.value?.columns ?? []).filter(
		c => c.id !== mainId.value && matchesMeasure(c) && (c.required || extraIds.value.includes(c.id)),
	),
);
const measureColumns = computed(() => tableColumns.value.filter(c => c.isMeasure));
/** Columnas opcionales que se pueden sumar (otras medidas, otros sistemas de talle). */
const optionalColumns = computed(() =>
	(template.value?.columns ?? []).filter(c => c.id !== mainId.value && !c.required && matchesMeasure(c)),
);

/** Ejemplo de cómo son los talles de una columna, para elegir el tipo. */
function example(col: MlSizeChartColumn): string {
	if (col.values.length) return t('admin.carga.ml.chart.create.exampleList', { examples: col.values.slice(0, 4).map(v => v.name).join(', ') });
	if (isNumberColumn(col)) return t('admin.carga.ml.chart.create.exampleNumber', { unit: col.units[0] ?? '' });
	return t('admin.carga.ml.chart.create.exampleText');
}

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
		sizeError.value = t('admin.carga.ml.chart.create.sizeNotNumber', { size: s, type: mainColumn.value?.name ?? '' });
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
	if (!name.value.trim()) return t('admin.carga.ml.chart.create.needName');
	if (template.value.general.some(c => !filled(c, general[c.id]))) return t('admin.carga.ml.chart.create.missing');
	const required = tableColumns.value.filter(c => c.required);
	if (sizes.value.some(s => required.some(c => !filled(c, rows[s]?.[c.id])))) return t('admin.carga.ml.chart.create.missing');
	return '';
});

function next() {
	if (stepMessage.value) return;
	if (step.value === 1) syncRows();
	step.value++;
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
	const base = `${t('admin.carga.ml.chart.create.defaultName')} ${props.gender} ${props.brand}`;
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
		mainId.value = guessMain(tpl);
		measureType.value = 'BODY_MEASURE';
		extraIds.value = [];
		sizes.value = sortSizes([...new Set((props.sizes ?? []).map(s => s.trim()).filter(Boolean))]);
		sizeInput.value = '';
		sizeError.value = '';
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
	if (!template.value || !mainColumn.value || stepMessage.value) return;
	saving.value = true;
	error.value = '';
	try {
		syncRows();
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
