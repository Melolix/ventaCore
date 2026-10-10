/**
 * Envíos de la tienda (envia.com): el cliente carga su dirección en el carrito,
 * ve las opciones cotizadas (transportista, precio y plazo) y la elegida se suma
 * al total del pedido.
 */

/** Dirección postal argentina. `provincia` es el código ISO 3166-2 sin el "AR-" (X = Córdoba). */
export interface Direccion {
	calle: string;
	numero: string;
	ciudad: string;
	provincia: string;
	cp: string;
	/** Piso, depto, entre calles… */
	referencia?: string;
}

/** Desde dónde despacha el rubro (origen de los envíos). */
export interface DespachoConfig extends Direccion {
	/** Quién despacha (nombre del local o de la persona). */
	nombre: string;
	telefono: string;
}

/** Medidas de un bulto: cm y gramos (las mismas unidades que el producto). */
export interface Paquete {
	largo: number;
	ancho: number;
	alto: number;
	peso: number;
}

/** Paquete que se asume cuando ni el producto ni el rubro tienen medidas. */
export const PAQUETE_FALLBACK: Paquete = { largo: 20, ancho: 20, alto: 10, peso: 1000 };

/** Una opción de envío cotizada. `id` = `carrier:service` (lo que se manda al pedir). */
export interface EnvioOpcion {
	id: string;
	carrier: string;
	service: string;
	/** Texto para el cliente, ej. "Andreani Estándar a Domicilio". */
	nombre: string;
	precio: number;
	/** Plazo estimado tal como lo informa el transportista ("2-7 días"), o null. */
	plazo: string | null;
}

/** Lo que manda la vitrina para cotizar. */
export interface CotizarEnvioInput {
	destino: Direccion;
	items: { productoId: string; cantidad: number }[];
}

export const PROVINCIAS_AR: { code: string; nombre: string }[] = [
	{ code: 'B', nombre: 'Buenos Aires' },
	{ code: 'C', nombre: 'Ciudad de Buenos Aires' },
	{ code: 'K', nombre: 'Catamarca' },
	{ code: 'H', nombre: 'Chaco' },
	{ code: 'U', nombre: 'Chubut' },
	{ code: 'X', nombre: 'Córdoba' },
	{ code: 'W', nombre: 'Corrientes' },
	{ code: 'E', nombre: 'Entre Ríos' },
	{ code: 'P', nombre: 'Formosa' },
	{ code: 'Y', nombre: 'Jujuy' },
	{ code: 'L', nombre: 'La Pampa' },
	{ code: 'F', nombre: 'La Rioja' },
	{ code: 'M', nombre: 'Mendoza' },
	{ code: 'N', nombre: 'Misiones' },
	{ code: 'Q', nombre: 'Neuquén' },
	{ code: 'R', nombre: 'Río Negro' },
	{ code: 'A', nombre: 'Salta' },
	{ code: 'J', nombre: 'San Juan' },
	{ code: 'D', nombre: 'San Luis' },
	{ code: 'Z', nombre: 'Santa Cruz' },
	{ code: 'S', nombre: 'Santa Fe' },
	{ code: 'G', nombre: 'Santiago del Estero' },
	{ code: 'V', nombre: 'Tierra del Fuego' },
	{ code: 'T', nombre: 'Tucumán' },
];

export const PROVINCIA_CODES: string[] = PROVINCIAS_AR.map(p => p.code);

/** Dirección en una línea, para mostrar y para los mensajes. */
export function formatDireccion(d: Direccion): string {
	const prov = PROVINCIAS_AR.find(p => p.code === d.provincia)?.nombre ?? d.provincia;
	const ref = d.referencia?.trim() ? ` (${d.referencia.trim()})` : '';
	return `${d.calle} ${d.numero}${ref}, ${d.ciudad}, ${prov} (CP ${d.cp})`;
}
