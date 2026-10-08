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
							<p class="line-clamp-2 text-sm font-semibold leading-tight text-surface-900 dark:text-surface-0">
								{{ line.producto.nombre }}<template v-if="line.producto.grupo && line.producto.variante"> — {{ line.producto.variante }}</template>
							</p>
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

				<div class="space-y-1 border-t border-surface-200 pt-3 dark:border-surface-700">
					<!-- Con envío elegido: productos + envío = total. -->
					<template v-if="envioElegido">
						<div class="flex justify-between text-sm text-surface-500">
							<span>{{ $t('public.cart.products') }}</span><span class="tabular-nums">{{ money(total) }}</span>
						</div>
						<div class="flex justify-between gap-3 text-sm text-surface-500">
							<span class="min-w-0 truncate">{{ $t('public.cart.shipping') }} · {{ envioElegido.nombre }}</span>
							<span class="shrink-0 tabular-nums">{{ money(envioElegido.precio) }}</span>
						</div>
					</template>
					<div class="flex items-baseline justify-between">
						<span class="font-bold text-surface-900 dark:text-surface-0">{{ $t('public.cart.total') }}</span>
						<span class="text-xl font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ money(totalConEnvio) }}</span>
					</div>
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
					<!-- Tienda con envíos cotizados: dirección completa → opciones con precio y plazo. -->
					<div v-if="cart.cliente.entrega === 'envio' && enviosActivos" class="space-y-3">
						<div class="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
							<div class="space-y-1">
								<label for="cart-calle" class="text-sm font-medium">{{ $t('public.cart.street') }}</label>
								<InputText id="cart-calle" v-model.trim="destino.calle" class="w-full" autocomplete="address-line1" :invalid="!!errors.destino && !destino.calle" />
							</div>
							<div class="space-y-1">
								<label for="cart-numero" class="text-sm font-medium">{{ $t('public.cart.number') }}</label>
								<InputText id="cart-numero" v-model.trim="destino.numero" class="w-full" inputmode="numeric" :invalid="!!errors.destino && !destino.numero" />
							</div>
						</div>
						<div class="space-y-1">
							<label for="cart-referencia" class="text-sm font-medium">{{ $t('public.cart.reference') }}</label>
							<InputText id="cart-referencia" v-model.trim="destino.referencia" class="w-full" autocomplete="address-line2" />
						</div>
						<div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
							<div class="space-y-1">
								<label for="cart-ciudad" class="text-sm font-medium">{{ $t('public.cart.city') }}</label>
								<InputText id="cart-ciudad" v-model.trim="destino.ciudad" class="w-full" autocomplete="address-level2" :invalid="!!errors.destino && !destino.ciudad" />
							</div>
							<div class="space-y-1">
								<label for="cart-cp" class="text-sm font-medium">{{ $t('public.cart.zip') }}</label>
								<InputText id="cart-cp" v-model.trim="destino.cp" class="w-full" inputmode="numeric" autocomplete="postal-code" :invalid="!!errors.destino && !cpValido" />
							</div>
						</div>
						<div class="space-y-1">
							<label for="cart-provincia" class="text-sm font-medium">{{ $t('public.cart.province') }}</label>
							<Select
								v-model="destino.provincia"
								input-id="cart-provincia"
								:options="provincias"
								option-label="nombre"
								option-value="code"
								fluid
								:placeholder="$t('public.cart.provincePlaceholder')"
								:invalid="!!errors.destino && !destino.provincia"
							/>
						</div>
						<p v-if="errors.destino" class="text-xs text-red-500">{{ errors.destino }}</p>

						<!-- Opciones de envío -->
						<button
							v-if="opciones === null"
							type="button"
							class="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
							:disabled="cotizando"
							@click="cotizar"
						>
							<i class="pi" :class="cotizando ? 'pi-spin pi-spinner' : 'pi-truck'" />
							{{ cotizando ? $t('public.cart.quoting') : $t('public.cart.quote') }}
						</button>
						<div v-else class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-widest text-surface-400">{{ $t('public.cart.shippingOptions') }}</p>
							<p v-if="!opciones.length" class="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
								{{ $t('public.cart.noQuotes') }}
							</p>
							<button
								v-for="op in opciones"
								:key="op.id"
								type="button"
								class="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors"
								:class="envioId === op.id ? 'border-primary bg-primary/10' : 'border-surface-200 dark:border-surface-700'"
								:aria-pressed="envioId === op.id"
								@click="envioId = op.id"
							>
								<i class="pi text-sm" :class="envioId === op.id ? 'pi-circle-fill text-primary' : 'pi-circle text-surface-400'" />
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-semibold leading-tight">{{ op.nombre }}</span>
									<span v-if="op.plazo" class="block text-xs text-surface-500">{{ op.plazo }}</span>
								</span>
								<span class="shrink-0 text-sm font-extrabold tabular-nums">{{ money(op.precio) }}</span>
							</button>
							<!-- Siempre queda la salida de coordinarlo directo con el vendedor. -->
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors"
								:class="envioId === COORDINAR ? 'border-primary bg-primary/10' : 'border-surface-200 dark:border-surface-700'"
								:aria-pressed="envioId === COORDINAR"
								@click="envioId = COORDINAR"
							>
								<i class="pi text-sm" :class="envioId === COORDINAR ? 'pi-circle-fill text-primary' : 'pi-circle text-surface-400'" />
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-semibold leading-tight">{{ $t('public.cart.coordinate') }}</span>
									<span class="block text-xs text-surface-500">{{ $t('public.cart.coordinateHint') }}</span>
								</span>
							</button>
							<p v-if="errors.envio" class="text-xs text-red-500">{{ errors.envio }}</p>
						</div>
					</div>
					<!-- Tienda sin cotización: una sola línea de dirección y se coordina. -->
					<div v-else-if="cart.cliente.entrega === 'envio'" class="space-y-1">
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
import { PROVINCIAS_AR, type EnvioOpcion, type PedidoPublic, type Producto } from '@base-template/shared';
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

/** Opción "lo coordino con el vendedor" (sin envío cotizado). */
const COORDINAR = 'coordinar';

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
		/** ¿La tienda cotiza envíos? (si no, el envío "se coordina"). */
		enviosActivos: { type: Boolean, default: false },
	},
	emits: ['update:visible'],
	data() {
		return {
			cart: useCartStore(),
			entregas: ['retiro', 'envio'] as Entrega[],
			errors: {} as Partial<Record<'nombre' | 'telefono' | 'direccion' | 'destino' | 'envio', string>>,
			provincias: PROVINCIAS_AR,
			COORDINAR,
			/** Opciones cotizadas para la dirección y el carrito actuales (null = todavía no cotizó). */
			opciones: null as EnvioOpcion[] | null,
			/** Opción elegida: id de envío, COORDINAR, o '' si no eligió. */
			envioId: '',
			cotizando: false,
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
		destino() {
			return this.cart.cliente.destino;
		},
		cpValido(): boolean {
			return /^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(this.destino.cp);
		},
		/** ¿Este pedido va con envío cotizado? */
		conCotizacion(): boolean {
			return this.enviosActivos && this.cart.cliente.entrega === 'envio';
		},
		envioElegido(): EnvioOpcion | null {
			if (!this.conCotizacion) return null;
			return this.opciones?.find(o => o.id === this.envioId) ?? null;
		},
		totalConEnvio(): number {
			return this.total + (this.envioElegido?.precio ?? 0);
		},
		/** Lo que define la cotización: si cambia, hay que volver a cotizar. */
		quoteKey(): string {
			const d = this.destino;
			return [d.calle, d.numero, d.ciudad, d.provincia, d.cp, ...this.lines.map(l => l.producto.id + 'x' + l.qty)].join('|');
		},
	},
	watch: {
		// Cambió la dirección o el carrito: la cotización anterior ya no vale.
		quoteKey() {
			this.opciones = null;
			this.envioId = '';
		},
	},
	methods: {
		destinoValido(): boolean {
			const d = this.destino;
			return d.calle.length >= 2 && !!d.numero && d.ciudad.length >= 2 && !!d.provincia && this.cpValido;
		},
		/** Pide las opciones de envío para la dirección y el carrito actuales. */
		async cotizar() {
			if (!this.destinoValido()) {
				this.errors = { ...this.errors, destino: this.$t('public.cart.err.destino') };
				return;
			}
			this.errors = { ...this.errors, destino: undefined, envio: undefined };
			this.cotizando = true;
			try {
				const d = this.destino;
				const opciones = await useCatalogStore().cotizarEnvio(this.rubroId, {
					destino: { calle: d.calle, numero: d.numero, ciudad: d.ciudad, provincia: d.provincia, cp: d.cp, referencia: d.referencia || undefined },
					items: this.lines.map(l => ({ productoId: l.producto.id, cantidad: l.qty })),
				});
				this.opciones = opciones;
				// La más barata queda elegida; si no hay ninguna, se coordina.
				this.envioId = opciones[0]?.id ?? COORDINAR;
			} catch (e: unknown) {
				this.errors = { ...this.errors, destino: apiErrorMessage(e, this.$t('public.cart.err.quote')) };
			} finally {
				this.cotizando = false;
			}
		},
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
			if (this.conCotizacion) {
				if (!this.destinoValido()) errors.destino = this.$t('public.cart.err.destino');
				else if (this.opciones === null) errors.destino = this.$t('public.cart.err.quoteFirst');
				else if (!this.envioId) errors.envio = this.$t('public.cart.err.pickShipping');
			} else if (c.entrega === 'envio' && c.direccion.length < 4) {
				errors.direccion = this.$t('public.cart.err.address');
			}
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
			];
			if (pedido.envio) parts.push(`${this.$t('public.cart.shipping')} (${pedido.envio.nombre}): ${this.money(pedido.envioCosto)}`);
			parts.push(`*${this.$t('public.cart.total')}: ${this.money(pedido.total)}*`);
			if (pedido.entrega === 'retiro') parts.push(`${this.$t('public.cart.delivery')}: ${this.$t('public.cart.entrega.retiro')}`);
			else {
				const modo = pedido.envio ? pedido.envio.nombre : this.$t('public.cart.entrega.envio');
				parts.push(`${this.$t('public.cart.delivery')}: ${modo} — ${pedido.direccion ?? ''}`);
			}
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
					direccion: c.entrega === 'envio' && !this.conCotizacion ? c.direccion : undefined,
					destino: this.conCotizacion
						? { calle: c.destino.calle, numero: c.destino.numero, ciudad: c.destino.ciudad, provincia: c.destino.provincia, cp: c.destino.cp, referencia: c.destino.referencia || undefined }
						: undefined,
					envioId: this.conCotizacion && this.envioId !== COORDINAR ? this.envioId : undefined,
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
