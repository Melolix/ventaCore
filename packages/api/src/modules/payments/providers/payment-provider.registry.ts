import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from '@base-template/shared';
import { LemonSqueezyProvider } from './lemon-squeezy.provider';
import { PaymentProviderService } from './payment-provider.interface';

/**
 * Resuelve la implementación de un proveedor por su enum. Para sumar Mercado
 * Pago: inyectar su provider acá y agregarlo al mapa.
 */
@Injectable()
export class PaymentProviderRegistry {
	private readonly byProvider: Map<PaymentProvider, PaymentProviderService>;

	constructor(lemonSqueezy: LemonSqueezyProvider) {
		this.byProvider = new Map<PaymentProvider, PaymentProviderService>([
			[lemonSqueezy.provider, lemonSqueezy],
		]);
	}

	get(provider: PaymentProvider): PaymentProviderService {
		const impl = this.byProvider.get(provider);
		if (!impl) {
			throw new BadRequestException(`El proveedor de cobro "${provider}" todavía no está disponible`);
		}
		return impl;
	}
}
