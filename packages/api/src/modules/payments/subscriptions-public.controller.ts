import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

/**
 * Endpoints públicos (sin auth) del tab de suscripciones de la vitrina. El
 * negocio se resuelve por el hostname, igual que el resto de `/public`.
 */
@ApiTags('public')
@Controller('public/subscriptions')
export class SubscriptionsPublicController {
	constructor(private readonly subs: SubscriptionsService) {}

	/** Rubros suscribibles del negocio del dominio actual, con sus planes. */
	@Get()
	@ApiQuery({ name: 'host', example: 'campo-ruta.localhost' })
	list(@Query('host') host: string) {
		return this.subs.listSubscribableByHost(host);
	}

	/** Inicia el checkout hosteado de un plan y devuelve la URL a la que redirigir. */
	@Post('checkout')
	checkout(@Body() dto: CreateCheckoutDto, @Headers('origin') origin?: string) {
		return this.subs.createCheckout(dto, origin ?? null);
	}
}
