import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MetaConnectionEntity } from './entities/meta-connection.entity';
import { MetaTargetEntity } from './entities/meta-target.entity';
import { MetaConnectionService } from './meta-connection.service';
import { MetaOauthService } from './meta-oauth.service';
import { MetaPublishService } from './meta-publish.service';
import { MetaController } from './meta.controller';
import { MetaConnectionsController } from './meta-connections.controller';
import { MetaPublishController } from './meta-publish.controller';

/**
 * Integración con redes sociales (Meta: Facebook + Instagram).
 *
 * La app de Meta (App ID + Secret) es ÚNICA de plataforma (META_APP_ID /
 * META_APP_SECRET en el entorno). Cada rubro solo conecta su propia Página/IG
 * vía OAuth; guarda los tokens cifrados y publica en el destino elegido.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([MetaConnectionEntity, MetaTargetEntity, RubroEntity, ProductoEntity]),
		UsersModule,
	],
	controllers: [MetaController, MetaConnectionsController, MetaPublishController],
	providers: [
		MetaConnectionService,
		MetaOauthService,
		MetaPublishService,
		TokenCryptoService,
		FirebaseAuthGuard,
		RolesGuard,
	],
	exports: [MetaConnectionService],
})
export class SocialModule {}
