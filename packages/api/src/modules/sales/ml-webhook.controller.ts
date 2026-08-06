import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MlNotificationsService } from './ml-notifications.service';

/**
 * Receptor de notificaciones (webhooks) de Mercado Libre. Es público: ML lo
 * llama sin nuestra sesión. ML NO firma los avisos, así que la validación real
 * es traer el recurso con el token del vendedor (lo hacen los handlers); acá
 * solo se verifica que el aviso sea de nuestra app (`application_id`).
 *
 * REGLA DE ORO de ML: hay que responder 200 rápido o ML reintenta y termina
 * deshabilitando el webhook. Por eso persistimos el aviso, respondemos 200 y
 * procesamos aparte sin bloquear la respuesta.
 *
 * Un mismo endpoint atiende TODOS los topics (orders_v2, shipments, questions,
 * items); el `MlNotificationsService` despacha por `topic`.
 */
@ApiExcludeController()
@Controller('webhooks')
export class MlWebhookController {
	constructor(private readonly notifications: MlNotificationsService) {}

	@Post('ml')
	@HttpCode(200)
	async receive(@Body() body: Record<string, unknown>) {
		const notif = await this.notifications.persist(body).catch(() => null);
		// Procesamos sin await: ML ya recibe su 200 y el trabajo pesado corre aparte.
		if (notif) void this.notifications.process(notif).catch(() => undefined);
		return { received: true };
	}
}
