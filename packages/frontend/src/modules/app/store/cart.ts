import { defineStore } from 'pinia';

/** Cómo recibe el pedido el cliente. Hasta integrar envíos, el envío "se coordina". */
export type Entrega = 'retiro' | 'envio';

/** Un pedido hecho desde este dispositivo (lo mínimo para listarlo y abrir su seguimiento). */
export interface PedidoGuardado {
	token: string;
	numero: number;
	rubroId: string;
	/** Nombre de la tienda donde se hizo. */
	tienda: string;
	total: number;
	createdAt: string;
}

/** Cuántos pedidos se recuerdan por dispositivo. */
const MAX_PEDIDOS = 30;

/**
 * Carrito de la tienda. Hay UN carrito por rubro (cada rubro es una tienda con
 * su propio destino de pedidos). Vive en el navegador del cliente (persistido en
 * localStorage) para que no se pierda si cierra la página; los datos del cliente
 * también, así no los vuelve a tipear en el próximo pedido.
 */
export const useCartStore = defineStore('cart', {
	state: () => ({
		/** `{ [rubroId]: { [productoId]: cantidad } }` */
		carts: {} as Record<string, Record<string, number>>,
		/** Pedidos hechos desde este dispositivo, del más nuevo al más viejo ("Mis pedidos"). */
		pedidos: [] as PedidoGuardado[],
		cliente: {
			nombre: '',
			telefono: '',
			entrega: 'retiro' as Entrega,
			direccion: '',
			/** Dirección estructurada (cuando la tienda cotiza envíos). */
			destino: { calle: '', numero: '', ciudad: '', provincia: '', cp: '', referencia: '' },
			notas: '',
		},
	}),
	getters: {
		qty:
			state =>
			(rubroId: string, productoId: string): number =>
				state.carts[rubroId]?.[productoId] ?? 0,
	},
	actions: {
		/** Fija la cantidad de un producto (0 o menos lo saca del carrito). */
		setQty(rubroId: string, productoId: string, qty: number): void {
			const cart = { ...(this.carts[rubroId] ?? {}) };
			if (qty > 0) cart[productoId] = qty;
			else delete cart[productoId];
			this.carts = { ...this.carts, [rubroId]: cart };
		},
		/** Recuerda un pedido (al enviarlo, o al abrir su link de seguimiento). Sin duplicar. */
		addPedido(pedido: PedidoGuardado): void {
			const rest = this.pedidos.filter(p => p.token !== pedido.token);
			this.pedidos = [pedido, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_PEDIDOS);
		},
		removePedido(token: string): void {
			this.pedidos = this.pedidos.filter(p => p.token !== token);
		},
		clear(rubroId: string): void {
			this.carts = { ...this.carts, [rubroId]: {} };
		},
	},
	persist: true,
});
