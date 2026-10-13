<template>
	<Dialog
		:visible="visible"
		modal
		:header="$t('admin.ml.talles.edit.title')"
		class="w-full max-w-3xl"
		@update:visible="emit('update:visible', $event)"
	>
		<div v-if="chart" class="flex flex-col gap-4 pt-1">
			<div class="space-y-1">
				<label class="text-sm font-medium">{{ $t('admin.ml.talles.edit.name') }}</label>
				<InputText v-model="name" maxlength="60" class="w-full" />
			</div>

			<!-- Lo que ML no deja tocar, dicho de entrada para no frustrar. -->
			<p class="flex items-start gap-1.5 rounded-lg bg-surface-50 p-2.5 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
				<i class="pi pi-info-circle mt-px" /> {{ $t('admin.ml.talles.edit.limits') }}
			</p>

			<!-- Celular: una tarjeta por talle; escritorio: tabla. -->
			<div class="space-y-2 sm:hidden">
				<div v-for="r in chart.rows" :key="r.id" class="rounded-xl border border-surface-200 p-3 dark:border-surface-700">
					<p class="mb-2 text-sm font-semibold">{{ $t('admin.carga.ml.chart.create.sizeCard', { size: r.size }) }}</p>
					<div v-for="col in chart.columns" :key="col.id" class="mb-2 space-y-1">
						<label class="text-xs text-surface-500">{{ col.name }}</label>
						<InputNumber v-if="col.editable" v-model="edits[r.id][col.id]" :min-fraction-digits="0" :max-fraction-digits="2" locale="es-AR" :suffix="col.unit ? ` ${col.unit}` : undefined" fluid />
						<p v-else class="text-sm">{{ r.values[col.id]?.name ?? '—' }}</p>
					</div>
				</div>
			</div>
			<div class="hidden overflow-x-auto rounded border border-surface-200 dark:border-surface-700 sm:block">
				<table class="w-full text-sm">
					<thead class="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800">
						<tr>
							<th class="whitespace-nowrap px-2 py-1.5 font-medium">{{ chart.mainName }}</th>
							<th v-for="col in chart.columns" :key="col.id" class="px-2 py-1.5 font-medium">{{ col.name }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in chart.rows" :key="r.id" class="border-t border-surface-200 dark:border-surface-700">
							<td class="whitespace-nowrap px-2 py-1.5 font-semibold">{{ r.size }}</td>
							<td v-for="col in chart.columns" :key="col.id" class="min-w-[8rem] px-2 py-1.5">
								<InputNumber v-if="col.editable" v-model="edits[r.id][col.id]" :min-fraction-digits="0" :max-fraction-digits="2" locale="es-AR" :suffix="col.unit ? ` ${col.unit}` : undefined" size="small" fluid />
								<span v-else class="text-surface-500">{{ r.values[col.id]?.name ?? '—' }}</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Talles nuevos: el talle + sus medidas. -->
			<div class="space-y-2">
				<div v-for="(n, i) in newRows" :key="i" class="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-primary/40 p-3">
					<div class="w-28 space-y-1">
						<label class="text-xs text-surface-500">{{ chart.mainName }} *</label>
						<InputText v-model="n.size" class="w-full" :placeholder="chart.mainUnit ? $t('admin.carga.ml.chart.create.sizePlaceholderNumber') : $t('admin.carga.ml.chart.create.sizePlaceholderText')" />
					</div>
					<div v-for="col in editableColumns" :key="col.id" class="min-w-[8rem] flex-1 space-y-1">
						<label class="text-xs text-surface-500">{{ col.name }}</label>
						<InputNumber v-model="n.values[col.id]" :min-fraction-digits="0" :max-fraction-digits="2" locale="es-AR" :suffix="col.unit ? ` ${col.unit}` : undefined" fluid />
					</div>
					<Button icon="pi pi-trash" text severity="secondary" :aria-label="$t('admin.ml.talles.edit.removeNew')" @click="newRows.splice(i, 1)" />
				</div>
				<Button :label="$t('admin.ml.talles.edit.addSize')" icon="pi pi-plus" text @click="addNewRow" />
			</div>

			<p v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{{ error }}</p>
		</div>

		<template #footer>
			<Button :label="$t('common.cancel')" text severity="secondary" @click="emit('update:visible', false)" />
			<Button :label="$t('admin.ml.talles.edit.save')" icon="pi pi-check" :loading="saving" :disabled="!dirty" @click="save" />
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MlManagedSizeChart, MlSizeChartCellInput } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

/**
 * Edita una guía de talles propia dentro de lo que ML permite: el nombre, las
 * medidas de cada talle y sumar talles nuevos (no cambiar ni quitar talles).
 */
const props = defineProps<{ visible: boolean; rubroId: string; chart: MlManagedSizeChart | null }>();
const emit = defineEmits<{ 'update:visible': [boolean]; saved: [MlManagedSizeChart] }>();

const { t } = useI18n();
const catalog = useCatalogStore();

const name = ref('');
/** Medidas editadas: fila → columna → número. */
const edits = reactive<Record<string, Record<string, number | null>>>({});
const newRows = ref<Array<{ size: string; values: Record<string, number | null> }>>([]);
const saving = ref(false);
const error = ref('');

const editableColumns = computed(() => (props.chart?.columns ?? []).filter(c => c.editable));

function original(rowId: string, colId: string): number | null {
	return props.chart?.rows.find(r => r.id === rowId)?.values[colId]?.number ?? null;
}

/** Celdas que cambiaron en una fila (solo las medidas numéricas). */
function changedCells(rowId: string): MlSizeChartCellInput[] {
	return editableColumns.value
		.filter(c => edits[rowId]?.[c.id] != null && edits[rowId][c.id] !== original(rowId, c.id))
		.map(c => ({ id: c.id, values: [{ number: edits[rowId][c.id]!, unit: c.unit ?? '' }] }));
}

const dirty = computed(() => {
	if (!props.chart) return false;
	if (name.value.trim() && name.value.trim() !== props.chart.name) return true;
	if (newRows.value.some(n => n.size.trim())) return true;
	return props.chart.rows.some(r => changedCells(r.id).length > 0);
});

function addNewRow() {
	newRows.value.push({ size: '', values: Object.fromEntries(editableColumns.value.map(c => [c.id, null])) });
}

function reset() {
	const c = props.chart;
	error.value = '';
	newRows.value = [];
	name.value = c?.name ?? '';
	for (const k of Object.keys(edits)) delete edits[k];
	for (const r of c?.rows ?? []) edits[r.id] = Object.fromEntries((c?.columns ?? []).map(col => [col.id, r.values[col.id]?.number ?? null]));
}

/** El talle nuevo en la columna principal: número + unidad ("38 AR") o texto ("XL"). */
function mainCell(size: string): MlSizeChartCellInput {
	const c = props.chart!;
	const n = Number(size.trim().replace(',', '.'));
	if (c.mainUnit && Number.isFinite(n)) return { id: c.mainAttributeId, values: [{ number: n, unit: c.mainUnit }] };
	return { id: c.mainAttributeId, values: [{ name: size.trim() }] };
}

async function save() {
	const c = props.chart;
	if (!c || !dirty.value) return;
	saving.value = true;
	error.value = '';
	let latest: MlManagedSizeChart = c;
	try {
		if (name.value.trim() && name.value.trim() !== c.name) latest = await catalog.renameMlSizeChart(props.rubroId, c.id, name.value.trim());
		for (const r of c.rows) {
			const cells = changedCells(r.id);
			if (cells.length) latest = await catalog.updateMlSizeChartRow(props.rubroId, c.id, r.id, { attributes: cells });
		}
		for (const n of newRows.value.filter(x => x.size.trim())) {
			if (c.mainUnit && !Number.isFinite(Number(n.size.trim().replace(',', '.')))) {
				throw new Error(t('admin.carga.ml.chart.create.sizeNotNumber', { size: n.size.trim(), type: c.mainName }));
			}
			const measures = editableColumns.value
				.filter(col => n.values[col.id] != null)
				.map(col => ({ id: col.id, values: [{ number: n.values[col.id]!, unit: col.unit ?? '' }] }));
			latest = await catalog.addMlSizeChartRow(props.rubroId, c.id, { attributes: [mainCell(n.size), ...measures] });
		}
		emit('saved', latest);
		emit('update:visible', false);
	} catch (e) {
		// Lo que se guardó antes del error queda guardado: refrescamos la guía igual.
		if (latest !== c) emit('saved', latest);
		error.value = e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e, t('admin.ml.talles.edit.error'));
	} finally {
		saving.value = false;
	}
}

watch(
	() => [props.visible, props.chart?.id],
	() => {
		if (props.visible) reset();
	},
	{ immediate: true },
);
</script>
