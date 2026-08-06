<template>
	<div>
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.ventas.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.ventas.pageTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.ventas.pageSubtitle') }}</p>
		</div>

		<!-- Sin negocio -->
		<div v-if="!rubro" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.ml.pickAbove') }}
		</div>

		<!-- Cargando -->
		<div v-else-if="loading" class="py-16 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>

		<!-- Negocio sin ML conectado -->
		<div v-else-if="!mlConnected" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-plug mb-3 block text-3xl text-amber-400" />
			<p class="mb-4">{{ $t('admin.ml.notConnectedHere', { nombre: rubro.nombre }) }}</p>
			<Button :label="$t('admin.rubros.configure')" icon="pi pi-cog" outlined @click="$router.push({ name: 'admin-configuraciones' })" />
		</div>

		<template v-else>
			<!-- Barra: sincronizar + total -->
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<span class="text-sm text-surface-500">{{ $t('admin.ml.ventas.count', { n: orders.length }) }}</span>
				<Button
					:label="$t('admin.ml.ventas.sync')"
					icon="pi pi-sync"
					size="small"
					outlined
					:loading="syncing"
					@click="sync"
				/>
			</div>

			<!-- Sin ventas -->
			<div v-if="!orders.length" class="glass-card rounded-2xl p-8 text-center text-surface-500">
				<i class="pi pi-receipt mb-3 block text-3xl text-surface-400" />
				<p class="mb-1">{{ $t('admin.ml.ventas.empty') }}</p>
				<p class="text-xs">{{ $t('admin.ml.ventas.emptyHint') }}</p>
			</div>

			<!-- Tabla de ventas -->
			<div v-else class="glass-card overflow-x-auto rounded-2xl">
				<table class="w-full text-sm">
					<thead class="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-700">
						<tr>
							<th class="px-4 py-3">{{ $t('admin.ml.ventas.colDate') }}</th>
							<th class="px-4 py-3">{{ $t('admin.ml.ventas.colProducts') }}</th>
							<th class="px-4 py-3 text-center">{{ $t('admin.ml.ventas.colQty') }}</th>
							<th class="px-4 py-3 text-right">{{ $t('admin.ml.ventas.colTotal') }}</th>
							<th class="px-4 py-3 text-right">{{ $t('admin.ml.ventas.colNet') }}</th>
							<th class="px-4 py-3">{{ $t('admin.ml.ventas.colStatus') }}</th>
							<th class="px-4 py-3">{{ $t('admin.ml.ventas.colBuyer') }}</th>
							<th class="px-4 py-3">{{ $t('admin.ml.ventas.colShipping') }}</th>
							<th class="px-4 py-3 text-center">{{ $t('admin.ml.ventas.colLabel') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="o in orders"
							:key="o.id"
							class="border-b border-surface-100 last:border-0 dark:border-surface-800"
						>
							<td class="whitespace-nowrap px-4 py-3 text-surface-500">{{ formatDate(o.dateCreated) }}</td>
							<td class="px-4 py-3">
								<div class="font-medium text-surface-900 dark:text-surface-0">{{ firstTitle(o) }}</div>
								<div v-if="o.items.length > 1" class="text-xs text-surface-400">
									{{ $t('admin.ml.ventas.moreItems', { n: o.items.length - 1 }) }}
								</div>
							</td>
							<td class="px-4 py-3 text-center">{{ totalQty(o) }}</td>
							<td class="whitespace-nowrap px-4 py-3 text-right">{{ money(o.totalAmount, o.currencyId) }}</td>
							<td class="whitespace-nowrap px-4 py-3 text-right text-surface-500">{{ money(o.neto, o.currencyId) }}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="statusClass(o.status)">
									{{ statusLabel(o.status) }}
								</span>
							</td>
							<td class="px-4 py-3 text-surface-500">{{ o.buyerNickname || '—' }}</td>
							<td class="px-4 py-3 text-surface-500">{{ shipmentLabel(o.shipmentStatus) }}</td>
							<td class="px-4 py-3 text-center">
								<div v-if="o.shippingId" class="flex justify-center gap-1">
									<Button
										icon="pi pi-print"
										size="small"
										text
										:title="$t('admin.ml.ventas.labelPdf')"
										:loading="busyLabel === o.id + ':pdf'"
										@click="printLabel(o, 'pdf')"
									/>
									<Button
										label="ZPL"
										size="small"
										text
										:title="$t('admin.ml.ventas.labelZpl')"
										:loading="busyLabel === o.id + ':zpl'"
										@click="printLabel(o, 'zpl')"
									/>
								</div>
								<span v-else class="text-xs text-surface-400">—</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MlOrderView, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';

export default defineComponent({
	name: 'VentasView',
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			syncing: false,
			mlConnected: false,
			orders: [] as MlOrderView[],
			busyLabel: null as string | null,
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
				this.orders = this.mlConnected ? await this.catalog.fetchMlOrders(this.rubro.id) : [];
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.ventas.loadError')), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		async sync() {
			if (!this.rubro) return;
			this.syncing = true;
			try {
				const res = await this.catalog.syncMlOrders(this.rubro.id);
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.ventas.synced', { n: res.imported }), life: 4000 });
				this.orders = await this.catalog.fetchMlOrders(this.rubro.id);
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.ventas.syncError')), life: 5000 });
			} finally {
				this.syncing = false;
			}
		},
		async printLabel(o: MlOrderView, format: 'pdf' | 'zpl') {
			if (!this.rubro) return;
			this.busyLabel = `${o.id}:${format}`;
			try {
				const blob = await this.catalog.fetchMlLabel(this.rubro.id, o.id, format);
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `etiqueta-${o.mlOrderId}.${format === 'zpl' ? 'zip' : 'pdf'}`;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.ventas.labelError')), life: 5000 });
			} finally {
				this.busyLabel = null;
			}
		},
		money(n: number | null, currency: string | null): string {
			if (n == null) return '—';
			return n.toLocaleString('es-AR', { style: 'currency', currency: currency || 'ARS', maximumFractionDigits: 0 });
		},
		formatDate(iso: string | null): string {
			if (!iso) return '—';
			return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
		},
		firstTitle(o: MlOrderView): string {
			return o.items[0]?.title || o.mlOrderId;
		},
		totalQty(o: MlOrderView): number {
			return o.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
		},
		statusLabel(status: string): string {
			const key = `admin.ml.ventas.status.${status}`;
			const label = this.$t(key);
			return label === key ? status : label;
		},
		statusClass(status: string): string {
			if (status === 'paid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
			if (status === 'cancelled') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
			return 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300';
		},
		shipmentLabel(status: string | null): string {
			if (!status) return '—';
			const key = `admin.ml.ventas.shipment.${status}`;
			const label = this.$t(key);
			return label === key ? status : label;
		},
	},
});
</script>
