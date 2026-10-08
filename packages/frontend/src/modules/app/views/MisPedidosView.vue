<template>
	<div class="mx-auto max-w-2xl">
		<div class="mb-4">
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.misPedidos.title') }}</h1>
			<p class="text-sm text-surface-500">{{ $t('public.misPedidos.subtitle') }}</p>
		</div>

		<!-- Sin pedidos en este dispositivo -->
		<div v-if="!rows.length" class="glass-card rounded-3xl p-10 text-center">
			<i class="pi pi-shopping-bag mb-3 block text-3xl text-surface-400" />
			<p class="font-semibold text-surface-800 dark:text-surface-100">{{ $t('public.misPedidos.emptyTitle') }}</p>
			<p class="mt-1 text-sm text-surface-500">{{ $t('public.misPedidos.emptyBody') }}</p>
			<Button :label="$t('public.pedido.backToStore')" class="mt-4" outlined @click="$router.push('/')" />
		</div>

		<!-- Un pedido por fila: lo justo para reconocerlo (número, tienda, cuándo, cuánto) y su estado. -->
		<ul v-else class="space-y-2">
			<li v-for="row in rows" :key="row.token">
				<router-link
					:to="{ name: 'app-pedido', params: { token: row.token } }"
					class="glass-card flex items-center gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lg"
					:class="row.cerrado ? 'opacity-70' : ''"
				>
					<div class="min-w-0 flex-1">
						<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span class="text-base font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.pedido.title', { n: row.numero }) }}</span>
							<span v-if="row.status" class="rounded-full px-2 py-0.5 text-[11px] font-bold" :class="statusCls(row.status)">
								{{ $t('public.misPedidos.status.' + row.status) }}
							</span>
							<span v-else-if="loading" class="text-xs text-surface-400"><i class="pi pi-spin pi-spinner text-[10px]" /></span>
						</p>
						<p class="truncate text-sm text-surface-600 dark:text-surface-300">{{ row.tienda }}</p>
						<p class="text-xs text-surface-500">{{ formatDate(row.createdAt) }}</p>
					</div>
					<p class="shrink-0 text-base font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(row.total) }}</p>
					<i class="pi pi-chevron-right shrink-0 text-xs text-surface-400" />
				</router-link>
			</li>
		</ul>

		<p v-if="rows.length" class="mt-4 flex items-start gap-2 text-xs text-surface-500">
			<i class="pi pi-mobile mt-0.5" /> {{ $t('public.misPedidos.deviceNote') }}
		</p>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { PedidoStatus } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useCartStore, type PedidoGuardado } from '@/modules/app/store/cart';
import { formatPrice } from '@/modules/app/utils/price';

interface Row extends PedidoGuardado {
	/** Estado actual según el servidor (null mientras carga o si no se pudo consultar). */
	status: PedidoStatus | null;
	cerrado: boolean;
}

/** Estados en los que el pedido ya terminó (van al final de la lista, más apagados). */
const CERRADOS: PedidoStatus[] = ['entregado', 'rechazado', 'cancelado'];

/**
 * "Mis pedidos": los pedidos que este cliente hizo desde este dispositivo (se
 * recuerdan en el navegador, igual que el carrito), con su estado al día. Cada
 * uno lleva a su seguimiento.
 */
export default defineComponent({
	name: 'MisPedidosView',
	data() {
		return {
			catalog: useCatalogStore(),
			cart: useCartStore(),
			loading: true,
			/** Estado y total actuales por token (lo que responde el servidor). */
			live: {} as Record<string, { status: PedidoStatus; total: number }>,
		};
	},
	computed: {
		/** En curso primero; dentro de cada grupo, del más nuevo al más viejo. */
		rows(): Row[] {
			const rows = this.cart.pedidos.map(p => {
				const live = this.live[p.token];
				const status = live?.status ?? null;
				return { ...p, total: live?.total ?? p.total, status, cerrado: !!status && CERRADOS.includes(status) };
			});
			return rows.sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || b.createdAt.localeCompare(a.createdAt));
		},
	},
	async created() {
		// Consultamos el estado de cada uno en paralelo; el que falle queda sin etiqueta.
		await Promise.all(
			this.cart.pedidos.map(async p => {
				try {
					const pedido = await this.catalog.fetchPedidoPublic(p.token);
					this.live = { ...this.live, [p.token]: { status: pedido.status, total: pedido.total } };
				} catch (e: unknown) {
					// El pedido ya no existe en la tienda: lo sacamos de la lista.
					if ((e as { response?: { status?: number } }).response?.status === 404) this.cart.removePedido(p.token);
				}
			}),
		);
		this.loading = false;
	},
	methods: {
		money(n: number): string {
			return formatPrice(n);
		},
		formatDate(iso: string): string {
			return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
		},
		statusCls(status: PedidoStatus): string {
			const map: Record<PedidoStatus, string> = {
				pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
				confirmado: 'bg-primary/15 text-primary',
				pagado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
				enviado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
				entregado: 'bg-surface-500/15 text-surface-600 dark:text-surface-300',
				rechazado: 'bg-red-500/15 text-red-600 dark:text-red-300',
				cancelado: 'bg-red-500/15 text-red-600 dark:text-red-300',
			};
			return map[status];
		},
	},
});
</script>
