import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MlConnectionService } from '../mercadolibre/ml-connection.service';
import { MlNotificationEntity } from './entities/ml-notification.entity';
import { MlOrdersService } from './ml-orders.service';
import { MlShipmentsService } from './ml-shipments.service';

/** Forma cruda de una notificación de Mercado Libre (solo lo que usamos). */
interface RawMlNotification {
	resource?: string;
	user_id?: number | string;
	topic?: string;
	application_id?: number | string;
	attempts?: number;
	sent?: string;
	received?: string;
}

/**
 * Recibe y despacha las notificaciones de Mercado Libre. Como ML es estricto con
 * el timeout del webhook, el trabajo se parte en dos:
 *  - `persist()`: guarda el aviso crudo YA (rápido) para no perderlo.
 *  - `process()`: resuelve el rubro por `user_id` y despacha por topic (puede
 *    tardar: en las fases siguientes hace un GET a la API de ML).
 *
 * El controller hace `await persist()` y luego dispara `process()` sin esperar,
 * así responde 200 sin bloquearse.
 */
@Injectable()
export class MlNotificationsService {
	private readonly logger = new Logger(MlNotificationsService.name);

	constructor(
		@InjectRepository(MlNotificationEntity)
		private readonly notifications: Repository<MlNotificationEntity>,
		private readonly connections: MlConnectionService,
		private readonly orders: MlOrdersService,
		private readonly shipments: MlShipmentsService,
	) {}

	/** Persiste el aviso crudo con estado 'received'. Devuelve la entidad guardada. */
	async persist(body: Record<string, unknown>): Promise<MlNotificationEntity> {
		const b = body as RawMlNotification;
		const notif = this.notifications.create({
			topic: b.topic ?? 'unknown',
			resource: b.resource ?? '',
			mlUserId: b.user_id != null ? String(b.user_id) : null,
			applicationId: b.application_id != null ? String(b.application_id) : null,
			attempts: typeof b.attempts === 'number' ? b.attempts : null,
			mlSentAt: b.sent ? new Date(b.sent) : null,
			payload: body,
			status: 'received',
		});
		return this.notifications.save(notif);
	}

	/** Resuelve el rubro dueño del aviso y despacha por topic. Corre sin bloquear la respuesta. */
	async process(notif: MlNotificationEntity): Promise<void> {
		// Aviso de otra app (no debería pasar): lo dejamos logueado e ignorado.
		const ourApp = process.env.ML_APP_ID?.trim();
		if (ourApp && notif.applicationId && notif.applicationId !== ourApp) {
			await this.finish(notif, 'ignored', 'application_id ajeno');
			return;
		}

		const owner = notif.mlUserId ? await this.connections.findByMlUserId(notif.mlUserId) : null;
		if (!owner) {
			await this.finish(notif, 'ignored', 'sin conexión de ML para ese user_id');
			return;
		}
		notif.rubroId = owner.rubroId;

		try {
			await this.dispatch(notif.topic, notif.resource, owner);
			await this.finish(notif, 'processed', null);
		} catch (e) {
			const msg = (e as Error).message;
			this.logger.error(`Error procesando ${notif.topic} ${notif.resource}: ${msg}`);
			await this.finish(notif, 'failed', msg);
		}
	}

	/**
	 * Despacha según el topic: `orders_v2` (ventas + stock) y `shipments` (estado
	 * del envío para la etiqueta). Los topics sin handler quedan logueados.
	 */
	private async dispatch(topic: string, resource: string, owner: { rubroId: string; espacioId: string }): Promise<void> {
		switch (topic) {
			case 'orders_v2':
			case 'orders':
				await this.orders.handleOrderNotification(resource, owner);
				break;
			case 'shipments':
				await this.shipments.handleShipmentNotification(resource, owner);
				break;
			default:
				this.logger.log(`topic sin handler: ${topic} (${resource})`);
		}
	}

	private async finish(notif: MlNotificationEntity, status: string, error: string | null): Promise<void> {
		notif.status = status;
		notif.error = error;
		notif.processedAt = new Date();
		await this.notifications.save(notif);
	}
}
