<template>
	<div class="mx-auto max-w-2xl">
		<div v-if="loading" class="py-24 text-center text-surface-400"><i class="pi pi-spin pi-spinner text-3xl" /></div>

		<div v-else-if="!pedido" class="glass-card rounded-3xl p-10 text-center">
			<i class="pi pi-search mb-3 block text-3xl text-surface-400" />
			<h1 class="text-xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.pedido.notFoundTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('public.pedido.notFoundBody') }}</p>
			<Button :label="$t('public.pedido.backToStore')" class="mt-4" outlined @click="$router.push('/')" />
		</div>

		<div v-else class="space-y-4">
			<!-- Volver a la lista de pedidos de este rubro (de ahí se entra a otro). -->
			<router-link
				:to="{ name: 'app-mis-pedidos', query: { rubro: pedido.rubroId } }"
				class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
			>
				<i class="pi pi-arrow-left text-xs" /> {{ $t('public.misPedidos.title') }}
			</router-link>
			<!-- Encabezado -->
			<div>
				<p class="text-xs font-extrabold uppercase tracking-widest text-primary">{{ pedido.tienda }}</p>
				<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.pedido.title', { n: pedido.numero }) }}</h1>
				<p class="text-sm text-surface-500">{{ $t('public.pedido.madeOn', { date: formatDate(pedido.createdAt) }) }}</p>
			</div>

			<!-- Estado actual: qué pasa ahora y qué tiene que hacer el cliente. -->
			<div class="rounded-2xl border p-4" :class="callout.cls">
				<p class="flex items-center gap-2 font-bold"><i :class="callout.icon" /> {{ callout.title }}</p>
				<p class="mt-1 text-sm">{{ callout.body }}</p>
				<p v-if="pedido.motivo && isClosed" class="mt-2 text-sm font-semibold">{{ $t('public.pedido.reason', { motivo: pedido.motivo }) }}</p>
			</div>

			<!-- Datos para transferir: aparecen recién cuando el vendedor confirmó. -->
			<div v-if="pedido.status === 'confirmado' && pedido.pago" class="glass-card space-y-3 rounded-2xl p-4 sm:p-5">
				<div class="flex items-baseline justify-between gap-3">
					<h2 class="font-bold text-surface-900 dark:text-surface-0">{{ $t('public.pedido.payTitle') }}</h2>
					<span class="text-xl font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(pedido.total) }}</span>
				</div>
				<p v-if="!pagoRows.length" class="text-sm text-surface-500">{{ $t('public.pedido.payMissing') }}</p>
				<div
					v-for="row in pagoRows"
					:key="row.key"
					class="flex items-center gap-3 rounded-xl border border-surface-200 px-3 py-2 dark:border-surface-700"
				>
					<div class="min-w-0 flex-1">
						<p class="text-[11px] font-bold uppercase tracking-wide text-surface-400">{{ $t('public.pedido.pay.' + row.key) }}</p>
						<p class="break-all text-sm font-semibold text-surface-900 dark:text-surface-0">{{ row.value }}</p>
					</div>
					<button
						v-if="row.copy"
						type="button"
						class="shrink-0 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 dark:border-surface-700"
						@click="copy(row.key, row.value)"
					>
						{{ copied === row.key ? $t('public.pedido.copied') : $t('public.pedido.copy') }}
					</button>
				</div>
				<a
					v-if="pedido.whatsapp"
					:href="waUrl($t('public.pedido.waPaid', { n: pedido.numero }))"
					target="_blank"
					rel="noopener"
					class="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
				>
					<i class="pi pi-whatsapp" /> {{ $t('public.pedido.sendReceipt') }}
				</a>
			</div>

			<!-- Envío generado: número de seguimiento y link del transportista. -->
			<div v-if="pedido.seguimiento" class="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 sm:p-5">
				<div class="min-w-0">
					<p class="text-[11px] font-bold uppercase tracking-wide text-surface-400">{{ $t('public.pedido.trackingNumber') }}</p>
					<p class="break-all text-base font-extrabold text-surface-900 dark:text-surface-0">{{ pedido.seguimiento.trackingNumber }}</p>
					<p v-if="pedido.envio" class="text-xs text-surface-500">{{ pedido.envio.nombre }}</p>
				</div>
				<a
					v-if="pedido.seguimiento.trackUrl"
					:href="pedido.seguimiento.trackUrl"
					target="_blank"
					rel="noopener"
					class="flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-contrast"
				>
					<i class="pi pi-map-marker" /> {{ $t('public.pedido.trackShipment') }}
				</a>
			</div>

			<!-- Recorrido: cada paso es un hito CUMPLIDO (✓); el siguiente es el que se espera. -->
			<ol v-if="!isClosed" class="glass-card rounded-2xl px-4 py-2 sm:px-5">
				<li
					v-for="(step, i) in steps"
					:key="step"
					class="flex items-center gap-3 border-b border-surface-200 py-3 text-sm last:border-0 dark:border-surface-700"
				>
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
						:class="i <= stepIndex
							? 'bg-emerald-500 text-white'
							: i === stepIndex + 1
								? 'bg-primary text-primary-contrast'
								: 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'"
					>
						<i v-if="i <= stepIndex" class="pi pi-check text-[10px]" />
						<template v-else>{{ i + 1 }}</template>
					</span>
					<span :class="i <= stepIndex + 1 ? 'font-semibold text-surface-900 dark:text-surface-0' : 'text-surface-400'">
						{{ $t('public.pedido.step.' + step) }}
					</span>
				</li>
			</ol>

			<!-- Detalle -->
			<div class="glass-card rounded-2xl p-4 sm:p-5">
				<h2 class="mb-1 font-bold text-surface-900 dark:text-surface-0">{{ $t('public.pedido.detail') }}</h2>
				<ul class="divide-y divide-surface-200 dark:divide-surface-700">
					<li v-for="it in pedido.items" :key="it.productoId" class="flex items-center gap-3 py-2.5">
						<div class="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
							<img v-if="it.imageUrl" :src="it.imageUrl" class="h-full w-full object-cover" alt="" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-2 text-sm font-semibold leading-tight text-surface-900 dark:text-surface-0">{{ it.nombre }}</p>
							<p class="text-xs text-surface-500">{{ it.cantidad }} × {{ money(it.precio) }}</p>
						</div>
						<p class="shrink-0 text-sm font-extrabold tabular-nums">{{ money(it.precio * it.cantidad) }}</p>
					</li>
				</ul>
				<div v-if="pedido.envio" class="flex justify-between gap-3 border-t border-surface-200 py-2.5 text-sm dark:border-surface-700">
					<span class="min-w-0 text-surface-600 dark:text-surface-300">
						{{ $t('public.cart.shipping') }} · {{ pedido.envio.nombre }}
						<span v-if="pedido.envio.plazo" class="block text-xs text-surface-500">{{ pedido.envio.plazo }}</span>
					</span>
					<span class="shrink-0 font-extrabold tabular-nums">{{ money(pedido.envioCosto) }}</span>
				</div>
				<div class="flex items-baseline justify-between border-t border-surface-200 pt-3 dark:border-surface-700">
					<span class="font-bold">{{ $t('public.cart.total') }}</span>
					<span class="text-lg font-extrabold tabular-nums">{{ money(pedido.total) }}</span>
				</div>
				<p class="mt-3 text-sm text-surface-500">
					{{ $t('public.cart.delivery') }}:
					<span class="font-semibold text-surface-700 dark:text-surface-200">{{ pedido.envio ? pedido.envio.nombre : $t('public.cart.entrega.' + pedido.entrega) }}</span>
					<template v-if="pedido.direccion"> — {{ pedido.direccion }}</template>
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				<a
					v-if="pedido.whatsapp"
					:href="waUrl($t('public.pedido.waAsk', { n: pedido.numero }))"
					target="_blank"
					rel="noopener"
					class="flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-surface-300 px-3 text-[13px] font-bold text-surface-700 hover:text-primary dark:border-surface-600 dark:text-surface-200"
				>
					<i class="pi pi-whatsapp" /> {{ $t('public.pedido.contact') }}
				</a>
				<button
					type="button"
					class="flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-surface-300 px-3 text-[13px] font-bold text-surface-700 hover:text-primary dark:border-surface-600 dark:text-surface-200"
					@click="$router.push({ name: 'app-rubro-detalle', params: { id: pedido.rubroId } })"
				>
					<i class="pi pi-shopping-bag" /> {{ $t('public.pedido.backToStore') }}
				</button>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { PedidoPublic, PedidoStatus } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useCartStore } from '@/modules/app/store/cart';
import { formatPrice } from '@/modules/app/utils/price';

/** Cada cuánto se refresca el estado mientras el pedido sigue abierto. */
const POLL_MS = 30_000;

/**
 * Seguimiento del pedido para el cliente (link `/pedido/<token>` que recibe al
 * pedir). Muestra en qué está, y los datos para transferir recién cuando el
 * vendedor lo confirma.
 */
export default defineComponent({
	name: 'PedidoView',
	data() {
		return {
			catalog: useCatalogStore(),
			cart: useCartStore(),
			loading: true,
			pedido: null as PedidoPublic | null,
			copied: '',
			timer: 0,
		};
	},
	computed: {
		/** Hitos del recorrido: con envío se suma "Enviado" antes de "Entregado". */
		steps(): PedidoStatus[] {
			return this.pedido?.entrega === 'envio'
				? ['pendiente', 'confirmado', 'pagado', 'enviado', 'entregado']
				: ['pendiente', 'confirmado', 'pagado', 'entregado'];
		},
		isClosed(): boolean {
			return this.pedido?.status === 'rechazado' || this.pedido?.status === 'cancelado';
		},
		stepIndex(): number {
			return this.pedido ? this.steps.indexOf(this.pedido.status) : 0;
		},
		/** Mensaje principal según el estado. */
		callout(): { title: string; body: string; icon: string; cls: string } {
			const s = this.pedido?.status ?? 'pendiente';
			const tone: Record<string, [string, string]> = {
				pendiente: ['pi pi-clock', 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'],
				confirmado: ['pi pi-check-circle', 'border-primary/30 bg-primary/10 text-primary'],
				pagado: ['pi pi-wallet', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
				enviado: ['pi pi-truck', 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'],
				entregado: ['pi pi-gift', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
				rechazado: ['pi pi-times-circle', 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'],
				cancelado: ['pi pi-times-circle', 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'],
			};
			return {
				title: this.$t(`public.pedido.state.${s}.title`),
				body: this.$t(`public.pedido.state.${s}.body`),
				icon: tone[s][0],
				cls: tone[s][1],
			};
		},
		pagoRows(): { key: string; value: string; copy: boolean }[] {
			const p = this.pedido?.pago;
			if (!p) return [];
			const rows = [
				{ key: 'alias', value: p.alias ?? '', copy: true },
				{ key: 'cbu', value: p.cbu ?? '', copy: true },
				{ key: 'titular', value: p.titular ?? '', copy: false },
			];
			return rows.filter(r => r.value);
		},
	},
	async created() {
		await this.load();
		this.loading = false;
		this.timer = window.setInterval(() => {
			const s = this.pedido?.status;
			if (s === 'pendiente' || s === 'confirmado' || s === 'pagado' || s === 'enviado') void this.load();
		}, POLL_MS);
	},
	beforeUnmount() {
		window.clearInterval(this.timer);
	},
	methods: {
		async load() {
			try {
				const pedido = await this.catalog.fetchPedidoPublic(String(this.$route.params.token));
				this.pedido = pedido;
				// Lo recordamos en este dispositivo: así aparece en "Mis pedidos" aunque
				// haya llegado por el link de WhatsApp.
				this.cart.addPedido({
					token: pedido.token,
					numero: pedido.numero,
					rubroId: pedido.rubroId,
					tienda: pedido.tienda,
					total: pedido.total,
					createdAt: pedido.createdAt,
				});
			} catch {
				// Si falla un refresco, nos quedamos con lo último que teníamos.
				if (this.loading) this.pedido = null;
			}
		},
		money(n: number): string {
			return formatPrice(n);
		},
		formatDate(iso: string): string {
			return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
		},
		waUrl(text: string): string {
			return `https://wa.me/${this.pedido?.whatsapp ?? ''}?text=${encodeURIComponent(text)}`;
		},
		async copy(key: string, value: string) {
			try {
				await navigator.clipboard.writeText(value);
				this.copied = key;
				window.setTimeout(() => (this.copied = ''), 2000);
			} catch {
				/* sin permiso de portapapeles: el dato igual está a la vista para copiarlo a mano */
			}
		},
	},
});
</script>
