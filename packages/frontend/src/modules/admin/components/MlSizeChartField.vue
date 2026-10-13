<template>
	<div class="space-y-2">
		<p v-if="!gender.trim() || !brand.trim()" class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
			<i class="pi pi-info-circle mt-px" /> {{ $t('admin.carga.ml.chart.needFilters') }}
		</p>

		<template v-else>
			<div class="flex gap-2">
				<Select
					:model-value="modelValue || null"
					:options="options"
					option-label="label"
					option-value="value"
					show-clear
					:loading="loading"
					:placeholder="$t('admin.carga.ml.chart.pick')"
					class="w-full min-w-0"
					@update:model-value="emit('update:modelValue', $event ?? '')"
				/>
				<Button icon="pi pi-refresh" size="small" text :title="$t('admin.carga.ml.chart.search')" :loading="loading" @click="load" />
			</div>

			<button
				v-if="standard && !modelValue"
				type="button"
				class="flex w-full items-start gap-1.5 rounded-lg bg-emerald-500/10 p-2 text-left text-xs text-emerald-700 dark:text-emerald-300"
				@click="emit('update:modelValue', standard.id)"
			>
				<i class="pi pi-star mt-px" />
				<span>{{ $t('admin.carga.ml.chart.recommendedStandard', { name: standard.name }) }}</span>
			</button>

			<p v-if="missing.length" class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
				<i class="pi pi-exclamation-triangle mt-px" /> {{ $t('admin.carga.ml.chart.missing', { sizes: missing.join(', ') }) }}
			</p>

			<!-- Sin guías para esta prenda / género / marca: crearla acá mismo. -->
			<p v-if="searched && !loading && !charts.length" class="text-xs text-amber-700 dark:text-amber-300">
				{{ $t('admin.carga.ml.chart.orCreate') }}
			</p>
			<Button
				:label="$t('admin.carga.ml.chart.create.button')"
				icon="pi pi-plus"
				size="small"
				:text="charts.length > 0"
				@click="createVisible = true"
			/>
		</template>

		<!-- Camino directo: el código que ML muestra al crear la guía. -->
		<div class="space-y-1 pt-1">
			<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.ml.chart.codeLabel') }}</label>
			<div class="flex gap-2">
				<InputText v-model="code" class="w-full min-w-0" inputmode="numeric" :placeholder="$t('admin.carga.ml.chart.codePlaceholder')" @keyup.enter="useCode" />
				<Button :label="$t('admin.carga.ml.chart.codeUse')" size="small" outlined class="shrink-0" :loading="codeLoading" @click="useCode" />
			</div>
		</div>

		<MlSizeChartCreateDialog
			v-model:visible="createVisible"
			:rubro-id="rubroId"
			:category-id="categoryId"
			:category-name="categoryName"
			:gender="gender"
			:brand="brand"
			:sizes="sizes"
			@created="onCreated"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { sameSize, type MlSizeChart } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';
import MlSizeChartCreateDialog from '@/modules/admin/components/MlSizeChartCreateDialog.vue';

/**
 * Guía de talles de un producto (v-model = SIZE_GRID_ID): busca las guías del
 * vendedor, permite cargar una por código o crear una nueva sin salir de VentaCore.
 */
const props = defineProps<{
	modelValue: string;
	rubroId: string;
	categoryId: string;
	/** Nombre de la categoría de ML (para el encabezado de "Crear guía"). */
	categoryName?: string;
	gender: string;
	brand: string;
	/** Talles del producto (para avisar si faltan en la guía y para crear una). */
	sizes: string[];
}>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const { t } = useI18n();
const toast = useToast();
const catalog = useCatalogStore();

const charts = ref<MlSizeChart[]>([]);
const loading = ref(false);
const searched = ref(false);
const code = ref('');
const codeLoading = ref(false);
const createVisible = ref(false);

// Primero las de ML y las de la marca (ya vienen completas); después las propias.
const typeOrder = (type: string) => (type === 'STANDARD' ? 0 : type === 'BRAND' ? 1 : 2);
const options = computed(() =>
	[...charts.value]
		.sort((a, b) => typeOrder(a.type) - typeOrder(b.type))
		.map(c => {
			const tag = c.type === 'STANDARD' || c.type === 'BRAND' ? ` · ${t(`admin.carga.ml.chart.typeTag.${c.type}`)}` : '';
			return { label: `${c.name}${tag} — ${c.rows.map(r => r.size).join(', ')}`, value: c.id };
		}),
);
/** Guía estándar de ML disponible (calzado): se recomienda antes que crear una propia. */
const standard = computed(() => charts.value.find(c => c.type === 'STANDARD'));

/** Talles del producto que no están en la guía elegida (ML los rechazaría). */
const missing = computed(() => {
	const chart = charts.value.find(c => c.id === props.modelValue);
	if (!chart) return [];
	// Sin la unidad del sistema: la guía dice "37 AR" y el producto "37".
	return props.sizes.filter(s => !chart.rows.some(r => sameSize(r.size, s)));
});

function add(chart: MlSizeChart) {
	if (!charts.value.some(c => c.id === chart.id)) charts.value.push(chart);
}

async function load() {
	if (!props.categoryId || !props.gender.trim() || !props.brand.trim()) return;
	loading.value = true;
	try {
		const res = await catalog.fetchMlSizeCharts(props.rubroId, props.categoryId, props.gender, props.brand);
		charts.value = res.charts;
		searched.value = true;
		// La guía ya elegida puede no salir en la búsqueda (se cargó por código): se trae igual.
		if (props.modelValue && !charts.value.some(c => c.id === props.modelValue)) {
			const chart = await catalog.fetchMlSizeChartById(props.rubroId, props.modelValue, props.categoryId).catch(() => null);
			if (chart) add(chart);
		}
	} catch (e) {
		toast.add({ severity: 'error', summary: apiErrorMessage(e, t('admin.carga.ml.chart.error')), life: 6000 });
	} finally {
		loading.value = false;
	}
}

async function useCode() {
	const id = code.value.trim();
	if (!id) return;
	codeLoading.value = true;
	try {
		const chart = await catalog.fetchMlSizeChartById(props.rubroId, id, props.categoryId);
		add(chart);
		emit('update:modelValue', chart.id);
		code.value = '';
		toast.add({ severity: 'success', summary: t('admin.carga.ml.chart.codeOk', { name: chart.name }), life: 4000 });
	} catch (e) {
		toast.add({ severity: 'error', summary: apiErrorMessage(e, t('admin.carga.ml.chart.codeError')), life: 6000 });
	} finally {
		codeLoading.value = false;
	}
}

function onCreated(chart: MlSizeChart) {
	add(chart);
	emit('update:modelValue', chart.id);
	toast.add({ severity: 'success', summary: t('admin.carga.ml.chart.create.created', { name: chart.name }), life: 5000 });
}

// Busca de nuevo cuando cambian categoría, género o marca (con pausa: la marca se tipea).
let timer: ReturnType<typeof setTimeout> | null = null;
watch(
	() => [props.categoryId, props.gender, props.brand],
	() => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void load(), 400);
	},
	{ immediate: true },
);
</script>
