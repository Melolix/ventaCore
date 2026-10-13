<template>
	<div>
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.talles.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.talles.pageTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.talles.pageSubtitle') }}</p>
		</div>

		<!-- Sin negocio -->
		<div v-if="!rubro" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.ml.pickAbove') }}
		</div>

		<!-- Cargando -->
		<div v-else-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-2xl" />
			<p class="mt-2 text-xs">{{ $t('admin.ml.talles.loading') }}</p>
		</div>

		<!-- Negocio sin ML conectado -->
		<div v-else-if="!mlConnected" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-plug mb-3 block text-3xl text-amber-400" />
			<p class="mb-4">{{ $t('admin.ml.notConnectedHere', { nombre: rubro.nombre }) }}</p>
			<Button :label="$t('admin.rubros.configure')" icon="pi pi-cog" outlined @click="$router.push({ name: 'admin-configuraciones' })" />
		</div>

		<template v-else>
			<!-- Sin guías: se crean desde la ficha de ML del producto. -->
			<div v-if="!charts.length" class="glass-card rounded-2xl p-8 text-center text-surface-500">
				<MlMeasureIllustration kind="shirt" :label="$t('admin.ml.talles.emptyTitle')" class="mx-auto mb-3 h-14 w-20" />
				<p class="font-semibold text-surface-700 dark:text-surface-200">{{ $t('admin.ml.talles.emptyTitle') }}</p>
				<p class="mx-auto mt-1 max-w-md text-sm">{{ $t('admin.ml.talles.emptyHint') }}</p>
				<Button class="mt-4" :label="$t('admin.ml.talles.goToProducts')" icon="pi pi-box" outlined @click="$router.push({ name: 'admin-carga-masiva' })" />
			</div>

			<div v-else class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<p class="text-xs text-surface-500">{{ $t('admin.ml.talles.count', charts.length) }}</p>
					<Button :label="$t('admin.ml.talles.refresh')" icon="pi pi-refresh" size="small" text :loading="loading" @click="reload" />
				</div>

				<div v-for="c in charts" :key="c.id" class="glass-card flex flex-wrap items-start gap-3 rounded-2xl p-4 sm:flex-nowrap sm:items-center">
					<MlMeasureIllustration :kind="kindOf(c)" :label="c.name" class="h-10 w-14 shrink-0 sm:h-12 sm:w-16" />
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-semibold text-surface-800 dark:text-surface-100">{{ c.name }}</p>
							<Tag v-if="c.status === 'INACTIVE'" severity="warn" :value="$t('admin.ml.talles.deleting')" />
						</div>
						<p class="text-xs text-surface-500">{{ [c.gender, c.brand].filter(Boolean).join(' · ') }} · {{ $t('admin.ml.talles.code', { id: c.id }) }}</p>
						<div class="flex flex-wrap gap-1">
							<span v-for="r in c.rows" :key="r.id" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{{ r.size }}</span>
						</div>
						<p class="text-xs" :class="c.usedBy.length ? 'text-surface-600 dark:text-surface-300' : 'text-surface-400'">
							<i class="pi pi-box mr-1 text-[10px]" />
							{{ c.usedBy.length ? $t('admin.ml.talles.usedBy', { list: usedList(c) }, c.usedBy.length) : $t('admin.ml.talles.unused') }}
						</p>
					</div>
					<div class="flex w-full shrink-0 gap-2 sm:w-auto">
						<Button :label="$t('admin.ml.talles.editBtn')" icon="pi pi-pencil" size="small" outlined :disabled="c.status === 'INACTIVE'" @click="openEdit(c)" />
						<Button
							:label="$t('admin.ml.talles.deleteBtn')"
							icon="pi pi-trash"
							size="small"
							severity="danger"
							text
							:disabled="c.status === 'INACTIVE' || deletingId === c.id"
							:loading="deletingId === c.id"
							@click="askDelete(c)"
						/>
					</div>
				</div>
			</div>
		</template>

		<MlSizeChartEditDialog v-if="rubro" v-model:visible="editVisible" :rubro-id="rubro.id" :chart="editing" @saved="onSaved" />
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MlManagedSizeChart, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { productKind, type ProductKind } from '@/modules/admin/utils/sizeChartMeasures';
import MlMeasureIllustration from '@/modules/admin/components/MlMeasureIllustration.vue';
import MlSizeChartEditDialog from '@/modules/admin/components/MlSizeChartEditDialog.vue';

/** Guías de talles propias del vendedor en Mercado Libre: ver, editar y borrar. */
export default defineComponent({
	name: 'GuiasTallesView',
	components: { MlMeasureIllustration, MlSizeChartEditDialog },
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			mlConnected: false,
			charts: [] as MlManagedSizeChart[],
			editVisible: false,
			editing: null as MlManagedSizeChart | null,
			deletingId: null as string | null,
		};
	},
	computed: {
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
		},
	},
	async created() {
		await this.reload();
	},
	watch: {
		// Se mira el rubro RESUELTO: en carga directa la lista de rubros llega tarde.
		'rubro.id'() {
			void this.reload();
		},
	},
	methods: {
		async reload() {
			if (!this.rubro) return;
			this.loading = true;
			try {
				const state = await this.catalog.fetchMlState(this.rubro.id);
				this.mlConnected = !!state.connection;
				this.charts = this.mlConnected ? await this.catalog.fetchMyMlSizeCharts(this.rubro.id) : [];
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.talles.loadError')), life: 5000 });
			} finally {
				this.loading = false;
			}
		},
		kindOf(c: MlManagedSizeChart): ProductKind {
			return productKind(c.domainId ?? '', [c.mainAttributeId, ...c.columns.map(col => col.id)]);
		},
		/** Productos que usan la guía: los primeros y "y N más". */
		usedList(c: MlManagedSizeChart): string {
			const first = c.usedBy.slice(0, 3).join(', ');
			return c.usedBy.length > 3 ? this.$t('admin.ml.talles.andMore', { list: first, n: c.usedBy.length - 3 }) : first;
		},
		openEdit(c: MlManagedSizeChart) {
			this.editing = c;
			this.editVisible = true;
		},
		onSaved(updated: MlManagedSizeChart) {
			this.charts = this.charts.map(c => (c.id === updated.id ? updated : c));
			if (this.editing?.id === updated.id) this.editing = updated;
			this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.talles.saved'), life: 3000 });
		},
		askDelete(c: MlManagedSizeChart) {
			// Si un producto la usa, ML no la va a borrar: lo decimos antes de pedir confirmación.
			if (c.usedBy.length) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.ml.talles.inUse', { list: this.usedList(c) }, c.usedBy.length), life: 7000 });
				return;
			}
			this.$confirm.require({
				header: this.$t('admin.ml.talles.deleteTitle'),
				message: this.$t('admin.ml.talles.deleteConfirm', { name: c.name }),
				acceptLabel: this.$t('admin.ml.talles.deleteBtn'),
				rejectLabel: this.$t('common.cancel'),
				acceptClass: 'p-button-danger',
				accept: () => void this.remove(c),
			});
		},
		async remove(c: MlManagedSizeChart) {
			if (!this.rubro) return;
			this.deletingId = c.id;
			try {
				await this.catalog.deleteMlSizeChart(this.rubro.id, c.id);
				// ML no la borra al instante: queda "borrándose" hasta que confirme (24 h).
				this.charts = this.charts.map(x => (x.id === c.id ? { ...x, status: 'INACTIVE' } : x));
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.talles.deleteRequested'), life: 7000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.talles.deleteError')), life: 7000 });
			} finally {
				this.deletingId = null;
			}
		},
	},
});
</script>
