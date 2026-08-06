import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MlConnectionService } from '../mercadolibre/ml-connection.service';
import { MlOrderEntity } from './entities/ml-order.entity';

/** Formato de etiqueta pedido desde el panel. */
export type LabelFormat = 'pdf' | 'zpl';

/** Etiqueta lista para bajar (bytes + tipo + nombre de archivo). */
export interface LabelFile {
	buffer: Buffer;
	contentType: string;
	filename: string;
}

/**
 * Envíos de Mercado Libre: mantiene el estado del shipment en las órdenes (para
 * habilitar la etiqueta) y baja la etiqueta lista para imprimir.
 *
 * Solo aplica a Mercado Envíos. La etiqueta está disponible cuando el envío está
 * en `ready_to_ship`.
 */
@Injectable()
export class MlShipmentsService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(MlOrderEntity)
		private readonly orders: Repository<MlOrderEntity>,
		private readonly connections: MlConnectionService,
	) {}

	// ── Entrada por webhook ──

	/**
	 * Procesa una notificación `shipments`: trae el envío y actualiza el
	 * `shipmentStatus` de las órdenes que lo referencian (por `shippingId`). Un
	 * mismo envío puede cubrir varias órdenes de un pack.
	 */
	async handleShipmentNotification(resource: string, owner: { rubroId: string; espacioId: string }): Promise<void> {
		const shipmentId = resource.split('/').filter(Boolean).pop() ?? '';
		if (!shipmentId) throw new Error(`Resource de envío inválido: ${resource}`);

		const { accessToken } = await this.connections.getValidAccessToken(owner.rubroId, owner.espacioId);
		const res = await fetch(`${this.apiHost}/shipments/${shipmentId}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
		if (!res.ok) throw new Error(`No se pudo traer el envío ${shipmentId}: ${body.message || res.statusText}`);

		await this.orders.update(
			{ shippingId: shipmentId, rubroId: owner.rubroId },
			{ shipmentStatus: body.status ?? null },
		);
	}

	// ── Etiqueta (on-demand desde el panel) ──

	/**
	 * Baja la etiqueta de una venta. `pdf` para impresora normal, `zpl` para
	 * térmica (Zebra) — ML devuelve un ZIP con el TXT ZPL. Valida que la venta
	 * tenga envío y (si lo conocemos) que esté listo para despachar.
	 */
	async getLabel(rubroId: string, espacioId: string, orderId: string, format: LabelFormat): Promise<LabelFile> {
		const order = await this.orders.findOne({ where: { id: orderId, rubroId, espacioId } });
		if (!order) throw new NotFoundException('Venta no encontrada');
		if (!order.shippingId) throw new BadRequestException('Esta venta todavía no tiene un envío de Mercado Libre');
		// Si conocemos el estado y NO está listo, cortamos con un mensaje claro. Si no
		// lo conocemos (null), lo intentamos igual y dejamos que ML decida.
		if (order.shipmentStatus && order.shipmentStatus !== 'ready_to_ship') {
			throw new BadRequestException('La etiqueta todavía no está disponible: el envío no está listo para despachar');
		}

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const responseType = format === 'zpl' ? 'zpl2' : 'pdf';
		const res = await fetch(
			`${this.apiHost}/shipment_labels?shipment_ids=${order.shippingId}&response_type=${responseType}`,
			{ headers: { authorization: `Bearer ${accessToken}` } },
		);
		if (!res.ok) {
			const msg = await res.text().catch(() => res.statusText);
			throw new BadRequestException(`No se pudo obtener la etiqueta: ${msg.slice(0, 150)}`);
		}

		const buffer = Buffer.from(await res.arrayBuffer());
		return format === 'zpl'
			? { buffer, contentType: 'application/zip', filename: `etiqueta-${order.mlOrderId}.zip` }
			: { buffer, contentType: 'application/pdf', filename: `etiqueta-${order.mlOrderId}.pdf` };
	}
}
