<template>
	<div>
		<!-- Encabezado -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.metricas.eyebrow') }}</p>
				<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.metricas.pageTitle') }}</h1>
				<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.metricas.pageSubtitle') }}</p>
			</div>
			<Button
				v-if="rubro && mlConnected"
				:label="$t('admin.ml.metricas.refresh')"
				icon="pi pi-refresh"
				size="small"
				outlined
				:loading="loading"
				@click="reload"
			/>
		</div>

		<!-- Sin negocio -->
		<div v-if="!rubro" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.ml.pickAbove') }}
		</div>

		<!-- Cargando -->
		<div v-else-if="loading && !metrics" class="py-16 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>

		<!-- Negocio sin ML conectado -->
		<div v-else-if="!mlConnected" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-plug mb-3 block text-3xl text-amber-400" />
			<p class="mb-4">{{ $t('admin.ml.notConnectedHere', { nombre: rubro.nombre }) }}</p>
			<Button :label="$t('admin.rubros.configure')" icon="pi pi-cog" outlined @click="$router.push({ name: 'admin-configuraciones' })" />
		</div>

		<!-- Dashboard -->
		<div v-else-if="metrics" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Publicaciones -->
			<div class="glass-card rounded-2xl p-5">
				<p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
					<i class="pi pi-shopping-cart text-primary" /> {{ $t('admin.ml.metricas.publicaciones') }}
				</p>
				<p class="text-3xl font-extrabold text-surface-900 dark:text-surface-0">{{ metrics.publicaciones.total }}</p>
				<div class="mt-3 space-y-1.5 text-sm">
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-surface-500"><span class="h-2 w-2 rounded-full bg-emerald-500" />{{ $t('admin.ml.metricas.active') }}</span>
						<span class="font-semibold tabular-nums">{{ metrics.publicaciones.active }}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-surface-500"><span class="h-2 w-2 rounded-full bg-amber-500" />{{ $t('admin.ml.metricas.paused') }}</span>
						<span class="font-semibold tabular-nums">{{ metrics.publicaciones.paused }}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-surface-500"><span class="h-2 w-2 rounded-full bg-surface-400" />{{ $t('admin.ml.metricas.closed') }}</span>
						<span class="font-semibold tabular-nums">{{ metrics.publicaciones.closed }}</span>
					</div>
				</div>
			</div>

			<!-- Ventas -->
			<div class="glass-card rounded-2xl p-5">
				<p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
					<i class="pi pi-receipt text-emerald-500" /> {{ $t('admin.ml.metricas.ventas') }}
				</p>
				<p class="text-3xl font-extrabold text-surface-900 dark:text-surface-0">{{ metrics.ventas.count }}</p>
				<p class="text-xs text-surface-400">{{ $t('admin.ml.metricas.ventasCount') }}</p>
				<div class="mt-3 space-y-1.5 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-surface-500">{{ $t('admin.ml.metricas.facturacion') }}</span>
						<span class="font-semibold tabular-nums">{{ money(metrics.ventas.facturacion) }}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-500">{{ $t('admin.ml.metricas.comision') }}</span>
						<span class="font-semibold tabular-nums text-amber-600 dark:text-amber-400">−{{ money(metrics.ventas.comision) }}</span>
					</div>
					<div class="flex items-center justify-between border-t border-surface-200 pt-1.5 dark:border-surface-700">
						<span class="text-surface-500">{{ $t('admin.ml.metricas.neto') }}</span>
						<span class="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ money(metrics.ventas.neto) }}</span>
					</div>
				</div>
			</div>

			<!-- Preguntas -->
			<div class="glass-card rounded-2xl p-5">
				<p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
					<i class="pi pi-comments text-sky-500" /> {{ $t('admin.ml.metricas.preguntas') }}
				</p>
				<div class="flex items-baseline gap-2">
					<p class="text-3xl font-extrabold" :class="metrics.preguntas.unanswered ? 'text-amber-500' : 'text-surface-900 dark:text-surface-0'">
						{{ metrics.preguntas.unanswered }}
					</p>
					<span class="text-sm text-surface-400">{{ $t('admin.ml.metricas.unanswered') }}</span>
				</div>
				<div class="mt-3 space-y-1.5 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-surface-500">{{ $t('admin.ml.metricas.answered') }}</span>
						<span class="font-semibold tabular-nums">{{ metrics.preguntas.answered }}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-500">{{ $t('admin.ml.metricas.responseRate') }}</span>
						<span class="font-semibold tabular-nums">{{ metrics.preguntas.responseRate != null ? Math.round(metrics.preguntas.responseRate * 100) + '%' : '—' }}</span>
					</div>
				</div>
			</div>

			<!-- Visitas -->
			<div class="glass-card rounded-2xl p-5 sm:col-span-2">
				<p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
					<i class="pi pi-eye text-violet-500" /> {{ $t('admin.ml.metricas.visitas') }}
				</p>
				<p class="text-3xl font-extrabold text-surface-900 dark:text-surface-0">{{ metrics.visitas.total }}</p>
				<p class="text-xs text-surface-400">{{ $t('admin.ml.metricas.visitas30') }}</p>
				<!-- Mini gráfico de barras por día -->
				<div v-if="metrics.visitas.days.length" class="mt-4 flex h-16 items-end gap-0.5">
					<div
						v-for="(d, i) in metrics.visitas.days"
						:key="i"
						class="flex-1 rounded-t bg-violet-400/70 transition-all hover:bg-violet-500 dark:bg-violet-500/50"
						:style="{ height: barHeight(d.total) }"
						:title="`${formatDay(d.date)}: ${d.total}`"
					/>
				</div>
				<p v-else class="mt-3 text-sm text-surface-400">{{ $t('admin.ml.metricas.noVisits') }}</p>
			</div>

			<!-- Reputación -->
			<div class="glass-card rounded-2xl p-5">
				<p class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
					<i class="pi pi-star text-yellow-500" /> {{ $t('admin.ml.metricas.reputacion') }}
				</p>
				<template v-if="metrics.reputacion && metrics.reputacion.transactionsTotal > 0">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-4 w-4 rounded-full" :class="repColor" />
						<span class="text-sm font-semibold capitalize">{{ repLabel }}</span>
					</div>
					<div class="space-y-1.5 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-surface-500">{{ $t('admin.ml.metricas.transactions') }}</span>
							<span class="font-semibold tabular-nums">{{ metrics.reputacion.transactionsCompleted }}/{{ metrics.reputacion.transactionsTotal }}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-surface-500">{{ $t('admin.ml.metricas.ratings') }}</span>
							<span class="font-semibold tabular-nums">
								<span class="text-emerald-500">{{ metrics.reputacion.ratingsPositive }}+</span>
								<span class="text-surface-400"> · {{ metrics.reputacion.ratingsNeutral }}</span>
								<span class="text-red-500"> · {{ metrics.reputacion.ratingsNegative }}−</span>
							</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-surface-500">{{ $t('admin.ml.metricas.claims') }}</span>
							<span class="font-semibold tabular-nums">{{ pct(metrics.reputacion.claimsRate) }}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-surface-500">{{ $t('admin.ml.metricas.cancellations') }}</span>
							<span class="font-semibold tabular-nums">{{ pct(metrics.reputacion.cancellationsRate) }}</span>
						</div>
					</div>
				</template>
				<p v-else class="text-sm text-surface-400">{{ $t('admin.ml.metricas.noReputation') }}</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MlMetrics, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';

export default defineComponent({
	name: 'MetricasView',
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			mlConnected: false,
			metrics: null as MlMetrics | null,
		};
	},
	computed: {
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
		},
		/** Máximo de visitas en un día (para escalar las barras). */
		maxVisits(): number {
			return Math.max(1, ...(this.metrics?.visitas.days.map(d => d.total) ?? [0]));
		},
		/** Color del nivel de reputación de ML (level_id tipo "5_green"). */
		repColor(): string {
			const lvl = this.metrics?.reputacion?.levelId ?? '';
			if (lvl.includes('green')) return 'bg-emerald-500';
			if (lvl.includes('yellow')) return 'bg-yellow-500';
			if (lvl.includes('orange')) return 'bg-orange-500';
			if (lvl.includes('red')) return 'bg-red-500';
			return 'bg-surface-400';
		},
		repLabel(): string {
			const lvl = this.metrics?.reputacion?.levelId;
			return lvl ? lvl.replace(/_/g, ' ') : this.$t('admin.ml.metricas.newSeller');
		},
	},
	async created() {
		await this.reload();
	},
	watch: {
		'ctx.currentRubroId'() {
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
				this.metrics = this.mlConnected ? await this.catalog.fetchMlMetrics(this.rubro.id) : null;
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.metricas.loadError')), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		money(n: number): string {
			const cur = this.metrics?.ventas.currencyId || 'ARS';
			return n.toLocaleString('es-AR', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
		},
		pct(rate: number): string {
			return (rate * 100).toFixed(1).replace(/\.0$/, '') + '%';
		},
		barHeight(total: number): string {
			return Math.max(4, Math.round((total / this.maxVisits) * 100)) + '%';
		},
		formatDay(iso: string): string {
			if (!iso) return '';
			return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
		},
	},
});
</script>
