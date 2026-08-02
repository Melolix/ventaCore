import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SpacesModule } from '../spaces/spaces.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { PaymentProviderConfigEntity } from './entities/payment-provider-config.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionEventEntity } from './entities/subscription-event.entity';
import { PaymentConfigService } from './payment-config.service';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { LemonSqueezyProvider } from './providers/lemon-squeezy.provider';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { PaymentsAdminController } from './payments-admin.controller';
import { SubscriptionsPublicController } from './subscriptions-public.controller';
import { WebhooksController } from './webhooks.controller';

/**
 * Suscripciones y cobros recurrentes. Modelo BYO: cada espacio conecta su propia
 * cuenta del proveedor (Lemon Squeezy; luego Mercado Pago).
 *  - Admin: config del proveedor + planes por rubro.
 *  - Público: listado de rubros suscribibles + inicio de checkout hosteado.
 *  - Webhook: fuente de verdad del estado de cada suscripción.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			PaymentProviderConfigEntity,
			SubscriptionPlanEntity,
			SubscriptionEntity,
			SubscriptionEventEntity,
			RubroEntity,
		]),
		UsersModule,
		SpacesModule,
	],
	controllers: [PaymentsAdminController, SubscriptionsPublicController, WebhooksController],
	providers: [
		PaymentConfigService,
		SubscriptionPlansService,
		SubscriptionsService,
		LemonSqueezyProvider,
		PaymentProviderRegistry,
		TokenCryptoService,
		FirebaseAuthGuard,
		RolesGuard,
	],
	exports: [PaymentConfigService, SubscriptionPlansService, SubscriptionsService],
})
export class PaymentsModule {}
