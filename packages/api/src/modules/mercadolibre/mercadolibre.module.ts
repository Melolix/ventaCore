import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlConnectionEntity } from './entities/ml-connection.entity';
import { MlAppConfigEntity } from './entities/ml-app-config.entity';
import { MlConnectionService } from './ml-connection.service';
import { MlOauthService } from './ml-oauth.service';
import { MlCatalogService } from './ml-catalog.service';
import { MlPublishService } from './ml-publish.service';
import { MlCallbackController } from './ml-callback.controller';
import { MlConnectionsController } from './ml-connections.controller';
import { MlCatalogController } from './ml-catalog.controller';
import { MlPublishController } from './ml-publish.controller';

/**
 * Integración con Mercado Libre.
 *
 * La conexión OAuth es por rubro (modelo BYO app): cada rubro carga su App
 * ID/Secret y conecta su cuenta de vendedor. Guarda access + refresh token
 * cifrados y los refresca automáticamente al publicar.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([MlConnectionEntity, MlAppConfigEntity, RubroEntity, ProductoEntity]),
		UsersModule,
	],
	controllers: [MlCallbackController, MlConnectionsController, MlCatalogController, MlPublishController],
	providers: [
		MlConnectionService,
		MlOauthService,
		MlCatalogService,
		MlPublishService,
		TokenCryptoService,
		FirebaseAuthGuard,
		RolesGuard,
	],
	exports: [MlConnectionService],
})
export class MercadoLibreModule {}
