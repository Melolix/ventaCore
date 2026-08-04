import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlConnectionEntity } from './entities/ml-connection.entity';
import { MlConnectionService } from './ml-connection.service';
import { MlOauthService } from './ml-oauth.service';
import { MlCatalogService } from './ml-catalog.service';
import { MlPricingService } from './ml-pricing.service';
import { MlPublishService } from './ml-publish.service';
import { MlImportService } from './ml-import.service';
import { MlCallbackController } from './ml-callback.controller';
import { MlConnectionsController } from './ml-connections.controller';
import { MlCatalogController } from './ml-catalog.controller';
import { MlPublishController } from './ml-publish.controller';
import { MlImportController } from './ml-import.controller';

/**
 * Integración con Mercado Libre.
 *
 * La app de Mercado Libre (client_id + secret) es ÚNICA de plataforma
 * (ML_APP_ID / ML_APP_SECRET en el entorno). Cada rubro solo conecta su cuenta
 * de vendedor vía OAuth; guarda access + refresh token cifrados y los refresca
 * automáticamente al publicar.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([MlConnectionEntity, RubroEntity, ProductoEntity]),
		UsersModule,
	],
	controllers: [
		MlCallbackController,
		MlConnectionsController,
		MlCatalogController,
		MlPublishController,
		MlImportController,
	],
	providers: [
		MlConnectionService,
		MlOauthService,
		MlCatalogService,
		MlPricingService,
		MlPublishService,
		MlImportService,
		TokenCryptoService,
		FirebaseAuthGuard,
		RolesGuard,
	],
	exports: [MlConnectionService],
})
export class MercadoLibreModule {}
