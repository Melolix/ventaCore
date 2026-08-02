import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseModule } from './common/firebase/firebase.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UserEntity } from './modules/users/entities/user.entity';
import { CatalogModule } from './modules/catalog/catalog.module';
import { RubroEntity } from './modules/catalog/entities/rubro.entity';
import { ProductoEntity } from './modules/catalog/entities/producto.entity';
import { SpacesModule } from './modules/spaces/spaces.module';
import { EspacioEntity } from './modules/spaces/entities/espacio.entity';
import { SocialModule } from './modules/social/social.module';
import { MetaConnectionEntity } from './modules/social/entities/meta-connection.entity';
import { MetaTargetEntity } from './modules/social/entities/meta-target.entity';
import { MetaAppConfigEntity } from './modules/social/entities/meta-app-config.entity';
import { MercadoLibreModule } from './modules/mercadolibre/mercadolibre.module';
import { MlConnectionEntity } from './modules/mercadolibre/entities/ml-connection.entity';
import { MlAppConfigEntity } from './modules/mercadolibre/entities/ml-app-config.entity';
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentProviderConfigEntity } from './modules/payments/entities/payment-provider-config.entity';
import { SubscriptionPlanEntity } from './modules/payments/entities/subscription-plan.entity';
import { SubscriptionEntity } from './modules/payments/entities/subscription.entity';
import { SubscriptionEventEntity } from './modules/payments/entities/subscription-event.entity';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TypeOrmModule.forRoot({
			type: 'postgres',
			host: process.env.DB_HOST || 'localhost',
			port: Number(process.env.DB_PORT) || 5432,
			username: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASSWORD || 'postgres',
			database: process.env.DB_NAME || 'base_template',
			entities: [
				UserEntity,
				RubroEntity,
				ProductoEntity,
				EspacioEntity,
				MetaConnectionEntity,
				MetaTargetEntity,
				MetaAppConfigEntity,
				MlConnectionEntity,
				MlAppConfigEntity,
				PaymentProviderConfigEntity,
				SubscriptionPlanEntity,
				SubscriptionEntity,
				SubscriptionEventEntity,
			],
			synchronize: process.env.DB_SYNCHRONIZE === 'true',
		}),
		FirebaseModule,
		AuthModule,
		UsersModule,
		SpacesModule,
		CatalogModule,
		SocialModule,
		MercadoLibreModule,
		PaymentsModule,
	],
})
export class AppModule {}
