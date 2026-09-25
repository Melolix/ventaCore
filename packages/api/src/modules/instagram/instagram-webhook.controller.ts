import { Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { InstagramInboundService } from './instagram-inbound.service';

/**
 * Webhook de mensajería de Instagram (DMs). Público: Meta lo llama sin nuestra
 * sesión. Mismo patrón que el de WhatsApp:
 *  - `GET`: verificación de suscripción (devolver `hub.challenge` si el token coincide).
 *  - `POST`: DMs entrantes; la seguridad es la firma `X-Hub-Signature-256` (HMAC con
 *    el App Secret de Meta) sobre el body CRUDO.
 *
 * Responde 200 rápido y procesa aparte para que Meta no reintente ni deshabilite.
 */
@ApiExcludeController()
@Controller('webhooks')
export class InstagramWebhookController {
	constructor(private readonly inbound: InstagramInboundService) {}

	/** Handshake de verificación: devuelve el challenge si el token coincide. */
	@Get('instagram')
	verify(
		@Query('hub.mode') mode: string,
		@Query('hub.verify_token') token: string,
		@Query('hub.challenge') challenge: string,
	): string {
		const expected = process.env.INSTAGRAM_VERIFY_TOKEN?.trim();
		if (mode === 'subscribe' && expected && token === expected) return challenge;
		throw new ForbiddenException('Verificación de webhook inválida');
	}

	/** Recepción de DMs. Verifica firma y procesa sin bloquear. */
	@Post('instagram')
	@HttpCode(200)
	receive(
		@Req() req: RawBodyRequest<Request>,
		@Headers('x-hub-signature-256') signature: string | undefined,
	) {
		void this.inbound.handleWebhook(req.rawBody, signature).catch(() => undefined);
		return { received: true };
	}
}
