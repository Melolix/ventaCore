import { Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappInboundService } from './whatsapp-inbound.service';

/**
 * Webhook de WhatsApp Cloud API. Público: Meta lo llama sin nuestra sesión.
 *  - `GET`: verificación de suscripción (Meta manda `hub.challenge`, hay que
 *    devolverlo tal cual si el `hub.verify_token` coincide con el nuestro).
 *  - `POST`: mensajes/estados entrantes. La seguridad real es la firma
 *    `X-Hub-Signature-256` (HMAC con el App Secret) sobre el body CRUDO.
 *
 * Como con ML: responder 200 rápido y procesar aparte, para que Meta no reintente
 * ni deshabilite el webhook.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WhatsappWebhookController {
	constructor(private readonly inbound: WhatsappInboundService) {}

	/** Handshake de verificación: devuelve el challenge si el token coincide. */
	@Get('whatsapp')
	verify(
		@Query('hub.mode') mode: string,
		@Query('hub.verify_token') token: string,
		@Query('hub.challenge') challenge: string,
	): string {
		const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
		if (mode === 'subscribe' && expected && token === expected) return challenge;
		throw new ForbiddenException('Verificación de webhook inválida');
	}

	/** Recepción de mensajes/estados. Verifica firma y procesa sin bloquear. */
	@Post('whatsapp')
	@HttpCode(200)
	receive(
		@Req() req: RawBodyRequest<Request>,
		@Headers('x-hub-signature-256') signature: string | undefined,
	) {
		// Sin await: Meta ya recibe su 200 y el trabajo corre aparte.
		void this.inbound.handleWebhook(req.rawBody, signature).catch(() => undefined);
		return { received: true };
	}
}
