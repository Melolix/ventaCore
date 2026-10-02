import { defineStore } from 'pinia';

/** Cómo recibe el pedido el cliente. Hasta integrar envíos, el envío "se coordina". */
export type Entrega = 'retiro' | 'envio';

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
		cliente: {
			nombre: '',
			telefono: '',
			entrega: 'retiro' as Entrega,
			direccion: '',
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
		clear(rubroId: string): void {
			this.carts = { ...this.carts, [rubroId]: {} };
		},
	},
	persist: true,
});
