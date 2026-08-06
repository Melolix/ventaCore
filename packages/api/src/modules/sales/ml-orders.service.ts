import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MlOrderItemView, MlOrderView, MlOrdersSyncResult } from '@base-template/shared';
import { MlConnectionService } from '../mercadolibre/ml-connection.service';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlOrderEntity } from './entities/ml-order.entity';

/** Forma cruda de una orden de Mercado Libre (solo lo que usamos). */
interface RawMlOrder {
	id?: number | string;
	status?: string;
	date_created?: string;
	date_closed?: string;
	total_amount?: number;
	paid_amount?: number;
	currency_id?: string;
	pack_id?: number | string | null;
	buyer?: { nickname?: string };
	shipping?: { id?: number | string };
	order_items?: Array<{
		item?: { id?: string; title?: string; seller_sku?: string; variation_id?: number | string };
		quantity?: number;
		unit_price?: number;
		sale_fee?: number;
	}>;
}

/**
 * Ventas concretadas de Mercado Libre. Trae las órdenes de ML (por webhook o por
 * backfill), las persiste en `ml_orders` (fuente del panel) y las expone como
 * vista pública. NO descuenta stock: eso es la Fase 2 (colgada del mismo upsert).
 *
 * Reutiliza `MlConnectionService.getValidAccessToken` para el token del rubro.
 */
@Injectable()
export class MlOrdersService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(MlOrderEntity)
		private readonly orders: Repository<MlOrderEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly connections: MlConnectionService,
	) {}

	// ── Entrada por webhook ──

	/**
	 * Procesa una notificación `orders_v2`: extrae el id de la orden del resource
	 * (`/orders/123` → `123`), la trae de ML y la upsertea. Lo llama el dispatcher
	 * de `MlNotificationsService`.
	 */
	async handleOrderNotification(resource: string, owner: { rubroId: string; espacioId: string }): Promise<void> {
		const mlOrderId = resource.split('/').filter(Boolean).pop() ?? '';
		if (!mlOrderId) throw new Error(`Resource de orden inválido: ${resource}`);
		const raw = await this.fetchOrder(owner.rubroId, owner.espacioId, mlOrderId);
		const order = await this.upsertFromMl(owner.rubroId, owner.espacioId, raw, 'webhook');
		await this.applyStock(order);
	}

	// ── Backfill / sincronización del historial ──

	/**
	 * Trae el historial de ventas pagadas del vendedor (`/orders/search`) y las
	 * upsertea. Sirve para arrancar el panel con datos y para reconciliar avisos
	 * perdidos. Pagina con un techo de seguridad.
	 */
	async backfill(rubroId: string, espacioId: string): Promise<MlOrdersSyncResult> {
		const { accessToken, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		if (!mlUserId) throw new BadRequestException('La conexión de Mercado Libre no tiene user_id; reconectá la cuenta');

		const limit = 50;
		const MAX_PAGES = 20; // techo: 1000 órdenes por sincronización
		let offset = 0;
		let total = 0;
		let imported = 0;

		for (let page = 0; page < MAX_PAGES; page++) {
			const params = new URLSearchParams({
				seller: mlUserId,
				'order.status': 'paid',
				sort: 'date_desc',
				limit: String(limit),
				offset: String(offset),
			});
			const res = await fetch(`${this.apiHost}/orders/search?${params.toString()}`, {
				headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
			});
			const body = (await res.json().catch(() => ({}))) as {
				results?: RawMlOrder[];
				paging?: { total?: number };
				message?: string;
			};
			if (!res.ok) throw new BadRequestException(`No se pudo sincronizar ventas: ${body.message || res.statusText}`);

			const results = body.results ?? [];
			total = body.paging?.total ?? total;
			for (const raw of results) {
				// Backfill: NO descuenta stock (las ventas históricas ya están reflejadas
				// en el stock actual; descontarlas de nuevo sería doble).
				await this.upsertFromMl(rubroId, espacioId, raw, 'backfill');
				imported++;
			}
			offset += limit;
			if (results.length < limit || offset >= total) break;
		}

		return { imported, total };
	}

	// ── Lectura para el panel ──

	/** Lista las ventas del rubro (scopeadas por espacio), como vista pública. */
	async list(
		rubroId: string,
		espacioId: string,
		filters: { status?: string; limit?: number; offset?: number },
	): Promise<MlOrderView[]> {
		const where: Record<string, unknown> = { rubroId, espacioId };
		if (filters.status) where.status = filters.status;
		const rows = await this.orders.find({
			where,
			order: { dateCreated: 'DESC' },
			take: filters.limit ?? 100,
			skip: filters.offset ?? 0,
		});
		return rows.map(r => MlOrdersService.toView(r));
	}

	// ── Helpers ──

	private async fetchOrder(rubroId: string, espacioId: string, mlOrderId: string): Promise<RawMlOrder> {
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const res = await fetch(`${this.apiHost}/orders/${mlOrderId}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as RawMlOrder & { message?: string };
		if (!res.ok) throw new Error(`No se pudo traer la orden ${mlOrderId}: ${body.message || res.statusText}`);
		return body;
	}

	/**
	 * Upsert por `mlOrderId`. Mapea los campos de la orden de ML a la entidad y
	 * guarda el crudo en `raw`. No toca `shipmentStatus` (Fase 3), lo maneja su flujo.
	 *
	 * `source` define el arranque de `stockApplied` en órdenes NUEVAS:
	 *  - 'webhook':  false → el descuento de stock se aplica después (`applyStock`).
	 *  - 'backfill': true  → la venta histórica ya está reflejada en el stock actual,
	 *    así que se marca como "ya aplicada" y nunca se descuenta.
	 * En órdenes existentes NO se pisa `stockApplied` (respeta lo ya aplicado).
	 */
	private async upsertFromMl(
		rubroId: string,
		espacioId: string,
		raw: RawMlOrder,
		source: 'webhook' | 'backfill',
	): Promise<MlOrderEntity> {
		const mlOrderId = raw.id != null ? String(raw.id) : '';
		if (!mlOrderId) throw new Error('Orden de Mercado Libre sin id');

		let order = await this.orders.findOne({ where: { mlOrderId } });
		if (!order) order = this.orders.create({ mlOrderId, rubroId, espacioId, stockApplied: source === 'backfill' });

		order.rubroId = rubroId;
		order.espacioId = espacioId;
		order.packId = raw.pack_id != null ? String(raw.pack_id) : null;
		order.status = raw.status ?? 'unknown';
		order.dateCreated = raw.date_created ? new Date(raw.date_created) : null;
		order.dateClosed = raw.date_closed ? new Date(raw.date_closed) : null;
		order.totalAmount = typeof raw.total_amount === 'number' ? raw.total_amount : null;
		order.paidAmount = typeof raw.paid_amount === 'number' ? raw.paid_amount : null;
		order.currencyId = raw.currency_id ?? null;
		order.buyerNickname = raw.buyer?.nickname ?? null;
		// El shipment puede llegar en un aviso posterior; no lo pisamos con null si ya lo teníamos.
		if (raw.shipping?.id != null) order.shippingId = String(raw.shipping.id);
		order.raw = raw as unknown as Record<string, unknown>;

		return this.orders.save(order);
	}

	/**
	 * Aplica el efecto de stock de la orden. Idempotente vía un reclamo atómico
	 * sobre `stockApplied`, así dos webhooks concurrentes de la misma orden no
	 * descuentan (ni reponen) dos veces:
	 *  - `paid` y todavía no aplicado → descuenta las cantidades.
	 *  - cancelada/inválida y ya aplicado → repone las cantidades.
	 */
	private async applyStock(order: MlOrderEntity): Promise<void> {
		if (order.status === 'paid' && !order.stockApplied) {
			const claimed = await this.orders.update({ id: order.id, stockApplied: false }, { stockApplied: true });
			if (claimed.affected === 1) await this.adjustStock(order, -1);
		} else if (MlOrdersService.isCancelled(order.status) && order.stockApplied) {
			const released = await this.orders.update({ id: order.id, stockApplied: true }, { stockApplied: false });
			if (released.affected === 1) await this.adjustStock(order, 1);
		}
	}

	/**
	 * Suma (`sign` = 1) o resta (`sign` = -1) las cantidades de la orden al stock
	 * de cada producto propio, matcheando por `mlItemId` dentro del rubro. Ignora
	 * los ítems sin producto local o con stock sin definir. Nunca deja stock < 0.
	 */
	private async adjustStock(order: MlOrderEntity, sign: 1 | -1): Promise<void> {
		const items = ((order.raw?.order_items as RawMlOrder['order_items']) ?? []) as NonNullable<RawMlOrder['order_items']>;
		for (const it of items) {
			const mlItemId = it.item?.id;
			const qty = it.quantity ?? 0;
			if (!mlItemId || qty <= 0) continue;
			const producto = await this.productos.findOne({ where: { mlItemId, rubroId: order.rubroId } });
			if (!producto || producto.stock == null) continue;
			producto.stock = Math.max(0, producto.stock + sign * qty);
			await this.productos.save(producto);
		}
	}

	private static isCancelled(status: string): boolean {
		return status === 'cancelled' || status === 'invalid';
	}

	private static toView(o: MlOrderEntity): MlOrderView {
		const rawItems = ((o.raw?.order_items as RawMlOrder['order_items']) ?? []) as NonNullable<RawMlOrder['order_items']>;
		const items: MlOrderItemView[] = rawItems.map(it => ({
			mlItemId: it.item?.id ?? '',
			title: it.item?.title ?? '',
			quantity: it.quantity ?? 0,
			unitPrice: typeof it.unit_price === 'number' ? it.unit_price : 0,
			saleFee: typeof it.sale_fee === 'number' ? it.sale_fee : null,
		}));
		const totalFee = items.reduce((sum, it) => sum + (it.saleFee ?? 0), 0);
		const neto = o.totalAmount != null ? o.totalAmount - totalFee : null;

		return {
			id: o.id,
			mlOrderId: o.mlOrderId,
			packId: o.packId,
			status: o.status,
			dateCreated: o.dateCreated ? o.dateCreated.toISOString() : null,
			dateClosed: o.dateClosed ? o.dateClosed.toISOString() : null,
			totalAmount: o.totalAmount,
			paidAmount: o.paidAmount,
			currencyId: o.currencyId,
			buyerNickname: o.buyerNickname,
			shippingId: o.shippingId,
			shipmentStatus: o.shipmentStatus,
			stockApplied: o.stockApplied,
			items,
			totalFee,
			neto,
		};
	}
}
