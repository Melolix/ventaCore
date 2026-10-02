<template>
	<div class="mx-auto max-w-4xl">
		<!-- Encabezado -->
		<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
			<div class="min-w-0">
				<p class="text-xs font-extrabold uppercase tracking-widest text-primary">{{ $t('admin.pedidos.eyebrow') }}</p>
				<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.pedidos.title') }}</h1>
				<p v-if="rubro" class="truncate text-sm text-surface-500">{{ rubro.nombre }}</p>
			</div>
			<Button :label="$t('admin.pedidos.refresh')" icon="pi pi-refresh" size="small" outlined :loading="loading" @click="load()" />
		</div>

		<div v-if="!rubroId" class="glass-card rounded-2xl p-10 text-center text-surface-500">{{ $t('admin.businessNone') }}</div>

		<template v-else>
			<!-- Sin datos para transferir: el cliente no tendría a dónde pagar al confirmar. -->
			<div
				v-if="rubro && !hasPago"
				class="mb-4 flex flex-col items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<p class="text-sm text-amber-800 dark:text-amber-200">{{ $t('admin.pedidos.noPago') }}</p>
				<Button :label="$t('admin.pedidos.goConfig')" icon="pi pi-cog" size="small" outlined class="shrink-0" @click="$router.push({ name: 'admin-rubros' })" />
			</div>

			<!-- Filtros por estado (con cantidad) -->
			<div class="mb-4 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
				<button
					v-for="f in filters"
					:key="f.key"
					type="button"
					class="flex min-w-0 flex-col items-center rounded-xl border px-1 py-1.5 transition-colors sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3"
					:class="filter === f.key
						? 'border-primary bg-primary/10 text-primary'
						: 'border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-300'"
					:aria-pressed="filter === f.key"
					@click="filter = f.key"
				>
					<span class="text-sm font-bold tabular-nums sm:order-last sm:font-semibold sm:opacity-70">{{ f.count }}</span>
					<span class="max-w-full truncate text-[11px] font-semibold sm:text-sm">{{ $t('admin.pedidos.filter.' + f.key) }}</span>
				</button>
			</div>

			<div v-if="loading && !pedidos.length" class="py-16 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>

			<div v-else-if="!visible.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				<i class="pi pi-inbox mb-2 block text-3xl text-surface-400" />
				{{ pedidos.length ? $t('admin.pedidos.emptyFilter') : $t('admin.pedidos.empty') }}
			</div>

			<div v-else class="space-y-3">
				<article v-for="p in visible" :key="p.id" class="glass-card rounded-2xl p-4 sm:p-5">
					<!-- Quién, cuándo, cuánto -->
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="text-base font-extrabold text-surface-900 dark:text-surface-0">#{{ p.numero }}</span>
								<span class="rounded-full px-2 py-0.5 text-[11px] font-bold" :class="statusCls(p.status)">{{ $t('admin.pedidos.status.' + p.status) }}</span>
							</p>
							<p class="truncate text-sm font-semibold text-surface-800 dark:text-surface-100">{{ p.clienteNombre }}</p>
							<p class="text-xs text-surface-500">{{ formatDate(p.createdAt) }} · {{ p.clienteTelefono }}</p>
						</div>
						<p class="shrink-0 text-lg font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(p.total) }}</p>
					</div>

					<!-- Qué pidió -->
					<ul class="mt-3 space-y-1 border-t border-surface-200 pt-3 text-sm dark:border-surface-700">
						<li v-for="it in p.items" :key="it.productoId" class="flex justify-between gap-3">
							<span class="min-w-0 text-surface-700 dark:text-surface-200">
								<span class="font-bold tabular-nums">{{ it.cantidad }} ×</span> {{ it.nombre }}
							</span>
							<span class="shrink-0 tabular-nums text-surface-500">{{ money(it.precio * it.cantidad) }}</span>
						</li>
					</ul>
					<p v-if="p.envio" class="mt-1 flex justify-between gap-3 text-sm">
						<span class="min-w-0 text-surface-700 dark:text-surface-200">{{ $t('public.cart.shipping') }} · {{ p.envio.nombre }}</span>
						<span class="shrink-0 tabular-nums text-surface-500">{{ money(p.envioCosto) }}</span>
					</p>
					<p class="mt-2 text-sm text-surface-500">
						<i class="pi mr-1 text-xs" :class="p.entrega === 'envio' ? 'pi-truck' : 'pi-shop'" />
						{{ p.envio ? p.envio.nombre : $t('public.cart.entrega.' + p.entrega) }}<template v-if="p.direccion"> — {{ p.direccion }}</template>
					</p>
					<p v-if="p.notas" class="mt-1 text-sm text-surface-500"><i class="pi pi-comment mr-1 text-xs" />{{ p.notas }}</p>
					<p v-if="p.motivo" class="mt-1 text-sm text-red-500">{{ $t('admin.pedidos.motivoLabel') }}: {{ p.motivo }}</p>

					<!-- Qué puede hacer el vendedor ahora -->
					<div class="mt-3 flex flex-wrap gap-2 border-t border-surface-200 pt-3 dark:border-surface-700">
						<template v-if="p.status === 'pendiente'">
							<Button :label="$t('admin.pedidos.accept')" icon="pi pi-check" size="small" :loading="busyId === p.id" @click="setStatus(p, 'confirmado')" />
							<Button :label="$t('admin.pedidos.reject')" icon="pi pi-times" size="small" severity="danger" outlined :disabled="busyId === p.id" @click="askMotivo(p, 'rechazado')" />
						</template>
						<template v-else-if="p.status === 'confirmado'">
							<!-- El paso clave: pasarle al cliente los datos para transferir. -->
							<a
								:href="waUrl(p, acceptMessage(p))"
								target="_blank"
								rel="noopener"
								class="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
							>
								<i class="pi pi-whatsapp" /> {{ $t('admin.pedidos.sendPago') }}
							</a>
							<Button :label="$t('admin.pedidos.markPaid')" icon="pi pi-wallet" size="small" outlined :loading="busyId === p.id" @click="setStatus(p, 'pagado')" />
							<Button :label="$t('admin.pedidos.cancel')" size="small" severity="danger" text :disabled="busyId === p.id" @click="askMotivo(p, 'cancelado')" />
						</template>
						<template v-else-if="p.status === 'pagado'">
							<Button :label="$t('admin.pedidos.markDelivered')" icon="pi pi-gift" size="small" :loading="busyId === p.id" @click="setStatus(p, 'entregado')" />
							<Button :label="$t('admin.pedidos.cancel')" size="small" severity="danger" text :disabled="busyId === p.id" @click="askMotivo(p, 'cancelado')" />
						</template>
						<a
							:href="waUrl(p, $t('admin.pedidos.waHello', { nombre: p.clienteNombre, n: p.numero }))"
							target="_blank"
							rel="noopener"
							class="ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg border border-surface-200 px-3 text-sm font-semibold text-surface-600 hover:text-primary dark:border-surface-700 dark:text-surface-300"
						>
							<i class="pi pi-whatsapp" /> <span class="hidden sm:inline">{{ $t('admin.pedidos.chat') }}</span>
						</a>
					</div>
				</article>
			</div>
		</template>

		<!-- Motivo al rechazar / cancelar (lo ve el cliente en su seguimiento) -->
		<Dialog v-model:visible="motivoVisible" modal :header="motivoTitle" class="w-full max-w-sm">
			<div class="space-y-2 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.pedidos.motivoHint') }}</p>
				<Textarea v-model.trim="motivo" class="w-full" rows="3" auto-resize :placeholder="$t('admin.pedidos.motivoPlaceholder')" />
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="motivoVisible = false" />
				<Button :label="motivoTitle" severity="danger" :loading="!!busyId" @click="confirmMotivo" />
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { Pedido, PedidoStatus, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { vitrinaUrl } from '@/shared/utils/site';
import { formatPrice } from '@/modules/app/utils/price';

type FilterKey = 'pendiente' | 'confirmado' | 'pagado' | 'entregado' | 'cerrados' | 'todos';

/** Cada cuánto se buscan pedidos nuevos con la pantalla abierta. */
const POLL_MS = 30_000;

/**
 * Número para wa.me a partir de lo que tipeó el cliente. Si no trae código de
 * país asumimos Argentina: 549 + característica + número, sin el 0 inicial ni
 * el 15 ("0351 15 555 0202" → 5493515550202).
 */
function waNumber(phone: string): string {
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('54')) return digits;
	const viejo = /^0(\d{2,4})15(\d{6,8})$/.exec(digits);
	if (viejo && viejo[1].length + viejo[2].length === 10) return '549' + viejo[1] + viejo[2];
	return '549' + digits.replace(/^0/, '');
}

/**
 * Pedidos de la tienda del negocio activo: el vendedor los acepta o rechaza, le
 * pasa al cliente los datos para transferir, y registra el pago y la entrega.
 */
export default defineComponent({
	name: 'PedidosView',
	setup() {
		return { ctx: useAdminContext() };
	},
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			pedidos: [] as Pedido[],
			filter: 'pendiente' as FilterKey,
			busyId: '',
			motivoVisible: false,
			motivo: '',
			motivoTarget: null as { pedido: Pedido; status: PedidoStatus } | null,
			timer: 0,
		};
	},
	computed: {
		rubroId(): string {
			return this.ctx.currentRubroId;
		},
		rubro(): Rubro | undefined {
			return this.catalog.rubroById(this.rubroId);
		},
		hasPago(): boolean {
			return !!(this.rubro?.pagoAlias || this.rubro?.pagoCbu);
		},
		filters(): { key: FilterKey; count: number }[] {
			const count = (s: PedidoStatus) => this.pedidos.filter(p => p.status === s).length;
			return [
				{ key: 'pendiente', count: count('pendiente') },
				{ key: 'confirmado', count: count('confirmado') },
				{ key: 'pagado', count: count('pagado') },
				{ key: 'entregado', count: count('entregado') },
				{ key: 'cerrados', count: count('rechazado') + count('cancelado') },
				{ key: 'todos', count: this.pedidos.length },
			];
		},
		visible(): Pedido[] {
			if (this.filter === 'todos') return this.pedidos;
			if (this.filter === 'cerrados') return this.pedidos.filter(p => p.status === 'rechazado' || p.status === 'cancelado');
			return this.pedidos.filter(p => p.status === this.filter);
		},
		motivoTitle(): string {
			return this.$t(this.motivoTarget?.status === 'rechazado' ? 'admin.pedidos.reject' : 'admin.pedidos.cancelTitle');
		},
	},
	watch: {
		'rubro.id'() {
			this.pedidos = [];
			void this.load();
		},
	},
	async created() {
		if (!this.catalog.rubros.length) await this.catalog.fetchRubros().catch(() => undefined);
		if (!this.catalog.miEspacio) await this.catalog.fetchMiEspacio().catch(() => undefined);
		await this.load();
		this.timer = window.setInterval(() => void this.load(true), POLL_MS);
	},
	beforeUnmount() {
		window.clearInterval(this.timer);
	},
	methods: {
		/** `silent`: refresco automático (sin spinner ni aviso si falla). */
		async load(silent = false) {
			if (!this.rubroId) return;
			if (!silent) this.loading = true;
			try {
				this.pedidos = await this.catalog.fetchPedidos(this.rubroId);
			} catch (e: unknown) {
				if (!silent) this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.load')), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		async setStatus(pedido: Pedido, status: PedidoStatus, motivo?: string) {
			this.busyId = pedido.id;
			try {
				const updated = await this.catalog.updatePedidoStatus(this.rubroId, pedido.id, status, motivo);
				const i = this.pedidos.findIndex(p => p.id === pedido.id);
				if (i !== -1) this.pedidos[i] = updated;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.pedidos.toast.' + status, { n: pedido.numero }), life: 3500 });
				// Lo seguimos mostrando: saltamos al filtro donde quedó.
				if (this.filter !== 'todos') this.filter = status === 'rechazado' || status === 'cancelado' ? 'cerrados' : (status as FilterKey);
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
			} finally {
				this.busyId = '';
			}
		},
		askMotivo(pedido: Pedido, status: PedidoStatus) {
			this.motivo = '';
			this.motivoTarget = { pedido, status };
			this.motivoVisible = true;
		},
		async confirmMotivo() {
			if (!this.motivoTarget) return;
			const { pedido, status } = this.motivoTarget;
			await this.setStatus(pedido, status, this.motivo || undefined);
			this.motivoVisible = false;
		},
		/** Link de seguimiento que ve el cliente (en el dominio de la vitrina). */
		trackingUrl(p: Pedido): string {
			const base = this.catalog.miEspacio ? vitrinaUrl(this.catalog.miEspacio) : window.location.origin;
			return `${base}/pedido/${p.token}`;
		},
		/** Mensaje de confirmación con los datos para transferir. */
		acceptMessage(p: Pedido): string {
			const r = this.rubro;
			const lines = [
				this.$t('admin.pedidos.msg.confirmed', { nombre: p.clienteNombre, n: p.numero, tienda: r?.nombre ?? '' }),
				`*${this.$t('public.cart.total')}: ${this.money(p.total)}*`,
			];
			if (this.hasPago) {
				lines.push('', this.$t('admin.pedidos.msg.payIntro'));
				if (r?.pagoAlias) lines.push(`${this.$t('public.pedido.pay.alias')}: ${r.pagoAlias}`);
				if (r?.pagoCbu) lines.push(`${this.$t('public.pedido.pay.cbu')}: ${r.pagoCbu}`);
				if (r?.pagoTitular) lines.push(`${this.$t('public.pedido.pay.titular')}: ${r.pagoTitular}`);
			}
			lines.push('', `${this.$t('admin.pedidos.msg.track')}: ${this.trackingUrl(p)}`);
			return lines.join('\n');
		},
		waUrl(p: Pedido, text: string): string {
			return `https://wa.me/${waNumber(p.clienteTelefono)}?text=${encodeURIComponent(text)}`;
		},
		statusCls(status: PedidoStatus): string {
			const map: Record<PedidoStatus, string> = {
				pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
				confirmado: 'bg-primary/15 text-primary',
				pagado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
				entregado: 'bg-surface-500/15 text-surface-600 dark:text-surface-300',
				rechazado: 'bg-red-500/15 text-red-600 dark:text-red-300',
				cancelado: 'bg-red-500/15 text-red-600 dark:text-red-300',
			};
			return map[status];
		},
		money(n: number): string {
			return formatPrice(n);
		},
		formatDate(iso: string): string {
			return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
		},
	},
});
</script>
