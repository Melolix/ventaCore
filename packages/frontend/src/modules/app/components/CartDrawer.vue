<template>
	<!-- "Tu pedido": panel al costado en desktop, pantalla completa en el celu. -->
	<Drawer
		:visible="visible"
		position="right"
		block-scroll
		:header="$t('public.cart.title')"
		:style="{ width: 'min(27rem, 100vw)' }"
		:pt="{ content: { class: '!p-0 flex flex-col' } }"
		@update:visible="$emit('update:visible', $event)"
	>
		<!-- Pedido enviado: quedó guardado con número; desde acá sigue su estado. -->
		<div v-if="done" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
			<span class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
				<i class="pi pi-check text-2xl" />
			</span>
			<p class="text-lg font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.cart.doneTitle', { n: done.numero }) }}</p>
			<p class="text-sm text-surface-500">{{ $t('public.cart.doneBody') }}</p>
			<a
				:href="done.waUrl"
				target="_blank"
				rel="noopener"
				class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
			>
				<i class="pi pi-whatsapp" /> {{ $t('public.cart.openWhatsapp') }}
			</a>
			<Button :label="$t('public.cart.track')" icon="pi pi-map-marker" outlined class="w-full" @click="goTrack" />
			<button type="button" class="text-sm font-semibold text-surface-500 hover:text-primary" @click="closeDone">
				{{ $t('public.cart.keepBrowsing') }}
			</button>
		</div>

		<!-- Vacío -->
		<div v-else-if="!lines.length" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-surface-500">
			<i class="pi pi-shopping-cart text-4xl text-surface-300 dark:text-surface-600" />
			<p class="font-semibold text-surface-700 dark:text-surface-200">{{ $t('public.cart.emptyTitle') }}</p>
			<p class="text-sm">{{ $t('public.cart.emptyBody') }}</p>
			<Button :label="$t('public.cart.keepBrowsing')" outlined size="small" @click="$emit('update:visible', false)" />
		</div>

		<template v-else>
			<div class="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
				<!-- Ítems -->
				<ul class="divide-y divide-surface-200 dark:divide-surface-700">
					<li v-for="line in lines" :key="line.producto.id" class="flex gap-3 py-3">
						<div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
							<img v-if="line.producto.imageUrl" :src="line.producto.imageUrl" class="h-full w-full object-cover" alt="" />
							<div v-else class="flex h-full w-full items-center justify-center text-surface-400"><i class="pi pi-shopping-bag" /></div>
						</div>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-2 text-sm font-semibold leading-tight text-surface-900 dark:text-surface-0">{{ line.producto.nombre }}</p>
							<p class="text-xs text-surface-500">{{ $t('public.cart.each', { price: money(line.precio) }) }}</p>
							<div class="mt-1.5 flex items-center gap-2">
								<div class="flex items-center rounded-lg border border-surface-200 dark:border-surface-700">
									<button
										type="button"
										class="flex h-8 w-8 items-center justify-center text-surface-600 hover:text-primary dark:text-surface-300"
										:aria-label="$t('public.cart.less')"
										@click="setQty(line, line.qty - 1)"
									>
										<i class="pi text-xs" :class="line.qty === 1 ? 'pi-trash' : 'pi-minus'" />
									</button>
									<span class="w-7 text-center text-sm font-bold tabular-nums">{{ line.qty }}</span>
									<button
										type="button"
										class="flex h-8 w-8 items-center justify-center text-surface-600 hover:text-primary disabled:opacity-30 dark:text-surface-300"
										:aria-label="$t('public.cart.more')"
										:disabled="line.qty >= line.max"
										@click="setQty(line, line.qty + 1)"
									>
										<i class="pi pi-plus text-xs" />
									</button>
								</div>
								<span v-if="line.qty >= line.max && line.producto.stock != null" class="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
									{{ $t('public.cart.maxStock') }}
								</span>
							</div>
						</div>
						<p class="shrink-0 text-sm font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(line.subtotal) }}</p>
					</li>
				</ul>

				<div class="flex items-baseline justify-between border-t border-surface-200 pt-3 dark:border-surface-700">
					<span class="font-bold text-surface-900 dark:text-surface-0">{{ $t('public.cart.total') }}</span>
					<span class="text-xl font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(total) }}</span>
				</div>

				<!-- Datos del cliente: lo mínimo para que el vendedor pueda responder. -->
				<div class="space-y-3">
					<p class="text-[11px] font-bold uppercase tracking-widest text-surface-400">{{ $t('public.cart.yourData') }}</p>
					<div class="space-y-1">
						<label for="cart-nombre" class="text-sm font-medium">{{ $t('public.cart.name') }}</label>
						<InputText id="cart-nombre" v-model.trim="cart.cliente.nombre" class="w-full" autocomplete="name" :invalid="!!errors.nombre" />
						<p v-if="errors.nombre" class="text-xs text-red-500">{{ errors.nombre }}</p>
					</div>
					<div class="space-y-1">
						<label for="cart-telefono" class="text-sm font-medium">{{ $t('public.cart.phone') }}</label>
						<InputText
							id="cart-telefono"
							v-model.trim="cart.cliente.telefono"
							class="w-full"
							type="tel"
							inputmode="tel"
							autocomplete="tel"
							placeholder="351 123 4567"
							:invalid="!!errors.telefono"
						/>
						<p v-if="errors.telefono" class="text-xs text-red-500">{{ errors.telefono }}</p>
					</div>
					<div class="space-y-1">
						<span class="text-sm font-medium">{{ $t('public.cart.delivery') }}</span>
						<div class="grid grid-cols-2 gap-2">
							<button
								v-for="opt in entregas"
								:key="opt"
								type="button"
								class="min-h-10 rounded-xl border px-2 text-sm font-semibold transition-colors"
								:class="cart.cliente.entrega === opt
									? 'border-primary bg-primary/10 text-primary'
									: 'border-surface-200 text-surface-600 dark:border-surface-700 dark:text-surface-300'"
								:aria-pressed="cart.cliente.entrega === opt"
								@click="cart.cliente.entrega = opt"
							>
								{{ $t('public.cart.entrega.' + opt) }}
							</button>
						</div>
					</div>
					<!-- La dirección solo si elige envío. -->
					<div v-if="cart.cliente.entrega === 'envio'" class="space-y-1">
						<label for="cart-direccion" class="text-sm font-medium">{{ $t('public.cart.address') }}</label>
						<InputText id="cart-direccion" v-model.trim="cart.cliente.direccion" class="w-full" autocomplete="street-address" :invalid="!!errors.direccion" />
						<p v-if="errors.direccion" class="text-xs text-red-500">{{ errors.direccion }}</p>
						<p v-else class="text-xs text-surface-500">{{ $t('public.cart.addressHint') }}</p>
					</div>
					<div class="space-y-1">
						<label for="cart-notas" class="text-sm font-medium">{{ $t('public.cart.notes') }}</label>
						<Textarea id="cart-notas" v-model.trim="cart.cliente.notas" class="w-full" rows="2" auto-resize />
					</div>
				</div>
			</div>

			<!-- Enviar: fijo abajo. La línea de arriba cuenta qué pasa después. -->
			<div class="space-y-2 border-t border-surface-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-surface-700">
				<p v-if="sendError" class="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300">{{ sendError }}</p>
				<p v-else class="text-xs text-surface-500">{{ $t('public.cart.nextStep') }}</p>
				<button
					type="button"
					class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
					:disabled="sending"
					@click="send"
				>
					<i class="pi" :class="sending ? 'pi-spin pi-spinner' : 'pi-whatsapp'" /> {{ $t('public.cart.send') }}
				</button>
			</div>
		</template>
	</Drawer>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { PedidoPublic, Producto } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { useCartStore, type Entrega } from '@/modules/app/store/cart';
import { formatPrice } from '@/modules/app/utils/price';

/** Una línea del pedido: el producto, la cantidad (ya acotada al stock) y su subtotal. */
export interface CartLine {
	producto: Producto;
	qty: number;
	/** Tope de unidades (el stock, o MAX_QTY si el negocio no lleva stock). */
	max: number;
	precio: number;
	subtotal: number;
}

/** Tope por producto cuando el negocio no lleva stock. */
export const MAX_QTY = 99;

/** ¿Se puede agregar al pedido? Necesita precio y no estar sin stock. */
export function canBuy(p: Producto): boolean {
	return p.precio != null && p.stock !== 0;
}

/**
 * Carrito de un rubro: ítems, datos del cliente y envío del pedido por WhatsApp
 * al número que corresponda (el del negocio o el del CM, según el rubro).
 */
export default defineComponent({
	name: 'CartDrawer',
	props: {
		visible: { type: Boolean, default: false },
		rubroId: { type: String, required: true },
		/** Nombre de la tienda (va en el encabezado del mensaje). */
		tienda: { type: String, default: '' },
		/** Productos públicos del rubro (para resolver nombre, precio y stock actuales). */
		productos: { type: Array as PropType<Producto[]>, required: true },
		/** Número de WhatsApp que recibe el pedido (solo dígitos). */
		whatsapp: { type: String, required: true },
	},
	emits: ['update:visible'],
	data() {
		return {
			cart: useCartStore(),
			entregas: ['retiro', 'envio'] as Entrega[],
			errors: {} as Partial<Record<'nombre' | 'telefono' | 'direccion', string>>,
			sending: false,
			/** Mensaje del servidor si no se pudo crear el pedido (ej. se quedó sin stock). */
			sendError: '',
			/** Pedido recién enviado (muestra la pantalla de confirmación). */
			done: null as { numero: number; token: string; waUrl: string } | null,
		};
	},
	computed: {
		/**
		 * Líneas válidas HOY: descarta productos que ya no existen, sin precio o sin
		 * stock, y acota la cantidad al stock actual (el carrito pudo quedar viejo).
		 */
		lines(): CartLine[] {
			const cart = this.cart.carts[this.rubroId] ?? {};
			const out: CartLine[] = [];
			for (const p of this.productos) {
				const want = cart[p.id];
				if (!want || !canBuy(p) || p.precio == null) continue;
				const max = p.stock ?? MAX_QTY;
				const qty = Math.min(want, max);
				out.push({ producto: p, qty, max, precio: p.precio, subtotal: p.precio * qty });
			}
			return out;
		},
		total(): number {
			return this.lines.reduce((sum, l) => sum + l.subtotal, 0);
		},
	},
	methods: {
		money(n: number): string {
			return formatPrice(n);
		},
		setQty(line: CartLine, qty: number) {
			this.cart.setQty(this.rubroId, line.producto.id, Math.min(qty, line.max));
		},
		closeDone() {
			this.done = null;
			this.$emit('update:visible', false);
		},
		goTrack() {
			const token = this.done?.token;
			this.closeDone();
			if (token) void this.$router.push({ name: 'app-pedido', params: { token } });
		},
		validate(): boolean {
			const c = this.cart.cliente;
			const errors: typeof this.errors = {};
			if (c.nombre.length < 2) errors.nombre = this.$t('public.cart.err.name');
			if (c.telefono.replace(/\D/g, '').length < 8) errors.telefono = this.$t('public.cart.err.phone');
			if (c.entrega === 'envio' && c.direccion.length < 4) errors.direccion = this.$t('public.cart.err.address');
			this.errors = errors;
			return !Object.keys(errors).length;
		},
		/**
		 * El pedido como texto de WhatsApp (los *asteriscos* son negrita en WhatsApp).
		 * Usa lo que GUARDÓ el servidor (número, ítems y precios), más el link de seguimiento.
		 */
		buildMessage(pedido: PedidoPublic): string {
			const c = this.cart.cliente;
			const rows = pedido.items.map(it => `• ${it.cantidad} × ${it.nombre} — ${this.money(it.precio * it.cantidad)}`);
			const parts = [
				`*${this.$t('public.cart.msg.title', { n: pedido.numero, tienda: this.tienda })}*`,
				`${this.$t('public.cart.msg.client')}: ${c.nombre}`,
				`${this.$t('public.cart.msg.phone')}: ${c.telefono}`,
				'',
				...rows,
				'',
				`*${this.$t('public.cart.total')}: ${this.money(pedido.total)}*`,
				c.entrega === 'envio'
					? `${this.$t('public.cart.delivery')}: ${this.$t('public.cart.entrega.envio')} — ${c.direccion}`
					: `${this.$t('public.cart.delivery')}: ${this.$t('public.cart.entrega.retiro')}`,
			];
			if (c.notas) parts.push(`${this.$t('public.cart.notes')}: ${c.notas}`);
			parts.push('', `${this.$t('public.cart.msg.track')}: ${window.location.origin}/pedido/${pedido.token}`);
			return parts.join('\n');
		},
		/**
		 * Guarda el pedido y abre WhatsApp con el mensaje armado. La pestaña se abre
		 * ANTES de esperar al servidor (dentro del toque del usuario): si se abriera
		 * después, el navegador la bloquearía como ventana emergente.
		 */
		async send() {
			if (!this.validate() || this.sending) return;
			this.sending = true;
			this.sendError = '';
			const tab = window.open('', '_blank');
			try {
				const c = this.cart.cliente;
				const pedido = await useCatalogStore().createPedido(this.rubroId, {
					clienteNombre: c.nombre,
					clienteTelefono: c.telefono,
					entrega: c.entrega,
					direccion: c.entrega === 'envio' ? c.direccion : undefined,
					notas: c.notas || undefined,
					items: this.lines.map(l => ({ productoId: l.producto.id, cantidad: l.qty })),
				});
				const waUrl = `https://wa.me/${this.whatsapp}?text=${encodeURIComponent(this.buildMessage(pedido))}`;
				if (tab) {
					tab.opener = null;
					tab.location.href = waUrl;
				}
				// El pedido ya está guardado: vaciamos el carrito y recordamos el seguimiento.
				this.cart.setUltimoPedido(this.rubroId, pedido.token, pedido.numero);
				this.cart.clear(this.rubroId);
				this.cart.cliente.notas = '';
				this.done = { numero: pedido.numero, token: pedido.token, waUrl };
			} catch (e: unknown) {
				tab?.close();
				this.sendError = apiErrorMessage(e, this.$t('public.cart.err.send'));
			} finally {
				this.sending = false;
			}
		},
	},
});
</script>
