import { Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentProvider } from '@base-template/shared';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Webhooks de los proveedores de cobro. Son públicos (el proveedor los llama sin
 * nuestra sesión): la seguridad está en la firma HMAC verificada con el secret
 * del espacio. La URL lleva el `espacioId` porque cada negocio tiene su propio
 * secret (modelo BYO). Necesita el body CRUDO → `rawBody: true` en `main.ts`.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
	constructor(private readonly subs: SubscriptionsService) {}

	@Post('lemon-squeezy/:espacioId')
	@HttpCode(200)
	async lemonSqueezy(
		@Param('espacioId', new ParseUUIDPipe()) espacioId: string,
		@Req() req: RawBodyRequest<Request>,
		@Headers() headers: Record<string, string | string[] | undefined>,
	) {
		await this.subs.handleWebhook(espacioId, PaymentProvider.LEMON_SQUEEZY, req.rawBody, headers);
		return { received: true };
	}
}
