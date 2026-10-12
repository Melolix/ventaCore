<template>
	<Dialog
		:visible="visible"
		modal
		:header="$t('admin.carga.ml.chart.create.title')"
		class="w-full max-w-4xl"
		@update:visible="emit('update:visible', $event)"
	>
		<div v-if="loading" class="flex items-center gap-2 py-6 text-sm text-surface-500">
			<i class="pi pi-spin pi-spinner" /> {{ $t('admin.carga.ml.chart.create.loading') }}
		</div>

		<div v-else-if="template" class="flex flex-col gap-4 pt-1">
			<p class="text-xs text-surface-500">{{ $t('admin.carga.ml.chart.create.intro', { gender, brand: brand || '—' }) }}</p>

			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.name') }}</label>
					<InputText v-model="name" maxlength="60" class="w-full" />
					<p class="text-[11px] text-surface-500">{{ $t('admin.carga.ml.chart.create.nameHint') }}</p>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.carga.ml.chart.create.main') }}</label>
					<Select v-model="mainId" :options="mainOptions" option-label="label" option-value="value" class="w-full" />
					<p class="text-[11px] text-surface-500">{{ $t('admin.carga.ml.chart.create.mainHint') }}</p>
				</div>
			</div>

			<!-- Atributos generales obligatorios de la guía (además de género y marca). -->
			<div v-if="template.general.length" class="grid gap-3 sm:grid-cols-2">
				<div v-for="col in template.general" :key="col.id" class="space-y-1">
					<label class="text-sm font-medium">{{ col.name }} *</label>
					<InputText v-if="!col.values.length" v-model="general[col.id].text" class="w-full" />
					<Select
						v-else
						v-model="general[col.id].ids[0]"
						:options="col.values"
						option-label="name"
						option-value="id"
						filter
						class="w-full"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="text-sm font-medium">
						{{ $t('admin.carga.ml.chart.create.sizes') }}
						<span v-if="sizes?.length" class="block text-[11px] font-normal text-surface-500">{{ $t('admin.carga.ml.chart.create.sizesHint') }}</span>
					</span>
					<MultiSelect
						v-if="optionalColumns.length"
						v-model="extraIds"
						:options="optionalColumns"
						option-label="name"
						option-value="id"
						:placeholder="$t('admin.carga.ml.chart.create.extraColumns')"
						size="small"
						class="w-full sm:w-64"
					/>
				</div>

				<div class="overflow-x-auto rounded border border-surface-200 dark:border-surface-700">
					<table class="w-full text-sm">
						<thead class="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
							<tr>
								<th v-for="col in visibleColumns" :key="col.id" class="whitespace-nowrap px-2 py-1.5 font-medium">
									{{ col.name }}<span v-if="col.required || col.id === mainId"> *</span>
									<span v-if="col.units.length" class="text-surface-400"> ({{ col.units.join(' / ') }})</span>
								</th>
								<th class="w-10" />
							</tr>
						</thead>
						<tbody>
							<tr v-for="(row, i) in rows" :key="i" class="border-t border-surface-200 dark:border-surface-700">
								<td v-for="col in visibleColumns" :key="col.id" class="min-w-[9rem] px-2 py-1.5 align-top">
									<div v-if="col.valueType === 'number_unit' || col.valueType === 'number'" class="flex gap-1">
										<InputNumber
											v-model="row[col.id].number"
											:min-fraction-digits="0"
											:max-fraction-digits="2"
											locale="es-AR"
											size="small"
											fluid
											class="min-w-0 flex-1"
										/>
										<Select
											v-if="col.units.length > 1"
											v-model="row[col.id].unit"
											:options="col.units"
											size="small"
											class="w-20 shrink-0"
										/>
									</div>
									<MultiSelect
										v-else-if="col.values.length && col.multivalued"
										v-model="row[col.id].ids"
										:options="col.values"
										option-label="name"
										option-value="id"
										filter
										size="small"
										class="w-full"
									/>
									<Select
										v-else-if="col.values.length"
										v-model="row[col.id].ids[0]"
										:options="col.values"
										option-label="name"
										option-value="id"
										filter
										size="small"
										class="w-full"
									/>
									<InputText v-else v-model="row[col.id].text" size="small" class="w-full" />
								</td>
								<td class="px-1 py-1.5 align-top">
									<Button
										icon="pi pi-trash"
										size="small"
										text
										severity="secondary"
										:title="$t('admin.carga.ml.chart.create.removeRow')"
										:disabled="rows.length === 1"
										@click="rows.splice(i, 1)"
									/>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between gap-2">
					<Button
						icon="pi pi-plus"
						:label="$t('admin.carga.ml.chart.create.addRow')"
						size="small"
						text
						:disabled="rows.length >= template.maxRows"
						@click="addRow"
					/>
					<span class="text-[11px] text-surface-500">{{ $t('admin.carga.ml.chart.create.maxRows', { max: template.maxRows }) }}</span>
				</div>
			</div>

			<p v-if="!valid" class="text-xs text-amber-600 dark:text-amber-400">{{ $t('admin.carga.ml.chart.create.missing') }}</p>
		</div>

		<p v-if="error" class="pt-2 text-xs text-red-500">{{ error }}</p>

		<template #footer>
			<Button :label="$t('admin.carga.ml.chart.create.cancel')" text severity="secondary" @click="emit('update:visible', false)" />
			<Button
				:label="$t('admin.carga.ml.chart.create.submit')"
				icon="pi pi-check"
				:loading="saving"
				:disabled="!template || !valid"
				@click="submit"
			/>
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
	MlSizeChartTemplate,
	MlSizeChartValueInput,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

/**
 * Crea una guía de talles propia (SPECIFIC) en Mercado Libre, armada a partir de
 * la ficha técnica de la guía del dominio (qué talles y medidas pide ML).
 */
const props = defineProps<{
	visible: boolean;
	rubroId: string;
	categoryId: string;
	gender: string;
	brand: string;
	/** Talles del producto (ej. ["36", "37"]): arrancan como filas de la guía. */
	sizes?: string[];
}>();
const emit = defineEmits<{ 'update:visible': [boolean]; created: [MlSizeChart] }>();

const { t } = useI18n();
const catalog = useCatalogStore();

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
const name = ref('');
const mainId = ref('');
const extraIds = ref<string[]>([]);
const general = reactive<Record<string, Cell>>({});
const rows = ref<Row[]>([]);

function emptyCell(col: MlSizeChartColumn): Cell {
	return { text: '', number: null, unit: col.defaultUnit ?? col.units[0] ?? '', ids: [] };
}

function emptyRow(): Row {
	const row: Row = {};
	for (const col of template.value?.columns ?? []) row[col.id] = emptyCell(col);
	return row;
}

function addRow() {
	rows.value.push(emptyRow());
}

/** Pone un talle en una celda: como opción de la lista si la hay, si no como texto. */
function setSize(col: MlSizeChartColumn | undefined, cell: Cell | undefined, size: string) {
	if (!col || !cell) return;
	if (col.values.length) {
		const match = col.values.find(v => v.name.trim().toLowerCase() === size.trim().toLowerCase());
		if (match) cell.ids = [match.id];
	} else if (col.valueType !== 'number' && col.valueType !== 'number_unit') {
		cell.text = size;
	}
}

/** Una fila por talle del producto, con el talle principal (y SIZE) ya cargados. */
function rowsFromSizes(): Row[] {
	const sizes = [...new Set((props.sizes ?? []).map(s => s.trim()).filter(Boolean))];
	if (!sizes.length) return [emptyRow()];
	const cols = template.value?.columns ?? [];
	const main = cols.find(c => c.id === mainId.value);
	const size = cols.find(c => c.id === 'SIZE' && c.id !== mainId.value);
	return sizes.map(s => {
		const row = emptyRow();
		setSize(main, row[main?.id ?? ''], s);
		setSize(size, row[size?.id ?? ''], s);
		return row;
	});
}

const mainOptions = computed(() =>
	(template.value?.columns ?? []).filter(c => c.mainCandidate).map(c => ({ label: c.name, value: c.id })),
);

/** Columnas opcionales que el vendedor puede sumar (ej. otros sistemas de talle). */
const optionalColumns = computed(() =>
	(template.value?.columns ?? []).filter(c => !c.required && c.id !== mainId.value),
);

/** Talle principal primero, después las obligatorias y las que sumó el vendedor. */
const visibleColumns = computed(() => {
	const cols = (template.value?.columns ?? []).filter(
		c => c.id === mainId.value || c.required || extraIds.value.includes(c.id),
	);
	return cols.sort((a, b) => Number(b.id === mainId.value) - Number(a.id === mainId.value));
});

function filled(col: MlSizeChartColumn, cell?: Cell): boolean {
	if (!cell) return false;
	if (col.valueType === 'number_unit') return cell.number != null && !!cell.unit;
	if (col.valueType === 'number') return cell.number != null;
	if (col.values.length) return cell.ids.some(Boolean);
	return !!cell.text.trim();
}

const valid = computed(() => {
	if (!template.value || !name.value.trim() || !mainId.value || !rows.value.length) return false;
	const required = visibleColumns.value.filter(c => c.required || c.id === mainId.value);
	if (template.value.general.some(c => !filled(c, general[c.id]))) return false;
	return rows.value.every(r => required.every(c => filled(c, r[c.id])));
});

function toValues(col: MlSizeChartColumn, cell: Cell): MlSizeChartValueInput[] {
	if (!filled(col, cell)) return [];
	if (col.valueType === 'number_unit') return [{ number: cell.number!, unit: cell.unit }];
	if (col.valueType === 'number') return [{ name: String(cell.number) }];
	if (col.values.length) {
		return cell.ids.filter(Boolean).map(id => ({ id, name: col.values.find(v => v.id === id)?.name }));
	}
	return [{ name: cell.text.trim() }];
}

function toCells(cols: MlSizeChartColumn[], source: Row): MlSizeChartCellInput[] {
	return cols.map(c => ({ id: c.id, values: toValues(c, source[c.id]) })).filter(c => c.values.length);
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
		mainId.value = tpl.suggestedMainId ?? tpl.columns.find(c => c.mainCandidate)?.id ?? '';
		extraIds.value = [];
		for (const key of Object.keys(general)) delete general[key];
		for (const col of tpl.general) general[col.id] = emptyCell(col);
		rows.value = rowsFromSizes();
		name.value = suggestedName();
	} catch (err) {
		error.value = apiErrorMessage(err, t('admin.carga.ml.chart.create.templateError'));
	} finally {
		loading.value = false;
	}
}

async function submit() {
	if (!template.value || !valid.value) return;
	saving.value = true;
	error.value = '';
	try {
		const created = await catalog.createMlSizeChart(props.rubroId, props.categoryId, {
			name: name.value.trim(),
			gender: props.gender,
			brand: props.brand || undefined,
			mainAttributeId: mainId.value,
			attributes: toCells(template.value.general, general),
			rows: rows.value.map(r => ({ attributes: toCells(visibleColumns.value, r) })),
		});
		emit('created', created);
		emit('update:visible', false);
	} catch (err) {
		error.value = apiErrorMessage(err, t('admin.carga.ml.chart.create.error'));
	} finally {
		saving.value = false;
	}
}

// Si cambia el talle principal, los talles del producto pasan a la columna nueva
// (sin pisar lo que ya se haya escrito ahí).
watch(mainId, id => {
	const col = template.value?.columns.find(c => c.id === id);
	const sizes = [...new Set((props.sizes ?? []).map(s => s.trim()).filter(Boolean))];
	if (!col || rows.value.length !== sizes.length) return;
	rows.value.forEach((row, i) => {
		if (!filled(col, row[col.id])) setSize(col, row[col.id], sizes[i]);
	});
});

// Cada vez que se abre, volvemos a pedir la ficha (puede cambiar género / marca / categoría).
watch(
	() => props.visible,
	open => {
		if (open) void load();
	},
	{ immediate: true },
);
</script>
