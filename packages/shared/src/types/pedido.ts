/**
 * Pedidos de la tienda: el cliente arma el carrito en la vitrina, el pedido se
 * guarda con número y se avisa al vendedor por WhatsApp. El vendedor lo acepta
 * (recién ahí el cliente ve los datos para transferir), registra el pago y la
 * entrega.
 */

import type { Direccion, EnvioOpcion } from './envio';

/** Estado del pedido. El camino feliz es pendiente → confirmado → pagado → entregado. */
export type PedidoStatus = 'pendiente' | 'confirmado' | 'pagado' | 'entregado' | 'rechazado' | 'cancelado';

export const PEDIDO_STATUSES: PedidoStatus[] = ['pendiente', 'confirmado', 'pagado', 'entregado', 'rechazado', 'cancelado'];

/** A qué estados puede pasar el vendedor desde cada uno. */
export const PEDIDO_TRANSITIONS: Record<PedidoStatus, PedidoStatus[]> = {
	pendiente: ['confirmado', 'rechazado'],
	confirmado: ['pagado', 'cancelado'],
	pagado: ['entregado', 'cancelado'],
	entregado: [],
	rechazado: [],
	cancelado: [],
};

/** Cómo recibe el pedido el cliente. Hasta integrar envíos, el envío "se coordina". */
export type PedidoEntrega = 'retiro' | 'envio';
export const PEDIDO_ENTREGAS: PedidoEntrega[] = ['retiro', 'envio'];

/** Una línea del pedido. Nombre y precio quedan CONGELADOS al momento de pedir. */
export interface PedidoItem {
	productoId: string;
	nombre: string;
	precio: number;
	cantidad: number;
	imageUrl: string | null;
}

/** Datos para transferir (se cargan una vez por rubro). */
export interface PedidoPago {
	alias: string | null;
	cbu: string | null;
	titular: string | null;
}

/** El pedido como lo ve el vendedor en el panel. */
export interface Pedido {
	id: string;
	rubroId: string;
	/** Número correlativo dentro del rubro (#1, #2…). */
	numero: number;
	/** Token del link de seguimiento del cliente (`/pedido/<token>`). */
	token: string;
	status: PedidoStatus;
	clienteNombre: string;
	clienteTelefono: string;
	entrega: PedidoEntrega;
	direccion: string | null;
	notas: string | null;
	items: PedidoItem[];
	/** Dirección estructurada (cuando el envío se cotizó). */
	destino: Direccion | null;
	/** Opción de envío elegida (transportista, servicio, precio cotizado). null = retiro o envío a coordinar. */
	envio: EnvioOpcion | null;
	/** Costo del envío incluido en `total` (0 si no hay). */
	envioCosto: number;
	/** Total a pagar: productos + envío. */
	total: number;
	/** Motivo que el vendedor le da al cliente al rechazar o cancelar. */
	motivo: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Lo que manda la vitrina para crear un pedido (los precios los pone el servidor). */
export interface CreatePedidoInput {
	clienteNombre: string;
	clienteTelefono: string;
	entrega: PedidoEntrega;
	direccion?: string;
	notas?: string;
	items: { productoId: string; cantidad: number }[];
	/** Con envío cotizado: la dirección y la opción elegida (`carrier:service`). El precio lo re-cotiza el servidor. */
	destino?: Direccion;
	envioId?: string;
}

/**
 * El pedido como lo ve el CLIENTE en su link de seguimiento. Los datos para
 * transferir (`pago`) solo vienen cuando el vendedor ya lo confirmó.
 */
export interface PedidoPublic {
	numero: number;
	token: string;
	status: PedidoStatus;
	clienteNombre: string;
	entrega: PedidoEntrega;
	direccion: string | null;
	items: PedidoItem[];
	envio: EnvioOpcion | null;
	envioCosto: number;
	total: number;
	motivo: string | null;
	createdAt: string;
	updatedAt: string;
	/** Nombre de la tienda (rubro) y WhatsApp de contacto (solo dígitos). */
	tienda: string;
	rubroId: string;
	whatsapp: string | null;
	pago: PedidoPago | null;
}
