/**
 * Ventas concretadas de Mercado Libre (panel del admin). Son vistas públicas:
 * NO llevan tokens ni el payload crudo de ML, solo lo que muestra el panel.
 */

/** Una línea de la venta (un producto y su cantidad). */
export interface MlOrderItemView {
	/** Id de la publicación en ML (para linkear al producto propio). */
	mlItemId: string;
	title: string;
	quantity: number;
	unitPrice: number;
	/** Comisión de ML de esta línea (si ML la informó). */
	saleFee: number | null;
}

/** Una venta concretada, tal como la ve el panel. */
export interface MlOrderView {
	id: string;
	/** Id de la orden en Mercado Libre. */
	mlOrderId: string;
	/** Id del pack (carrito) si vino agrupada, o null. */
	packId: string | null;
	/** Estado de la orden en ML: 'paid' | 'cancelled' | 'confirmed' | ... */
	status: string;
	dateCreated: string | null;
	dateClosed: string | null;
	totalAmount: number | null;
	paidAmount: number | null;
	currencyId: string | null;
	buyerNickname: string | null;
	/** Id del envío (para la etiqueta). null hasta que ML crea el shipment. */
	shippingId: string | null;
	/** Estado del envío: 'ready_to_ship' habilita la etiqueta. */
	shipmentStatus: string | null;
	/** ¿Ya se descontó el stock por esta venta? */
	stockApplied: boolean;
	items: MlOrderItemView[];
	/** Comisión total de ML (suma de las líneas). */
	totalFee: number;
	/** Neto estimado que recibe el vendedor: total − comisión (sin contar envío). */
	neto: number | null;
}

/** Resultado del backfill/sincronización del historial de ventas. */
export interface MlOrdersSyncResult {
	/** Órdenes traídas de ML y upserteadas. */
	imported: number;
	/** Total que ML dice tener para ese vendedor (paging.total). */
	total: number;
}
