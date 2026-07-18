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
import { MetaAppConfigEntity } from './entities/meta-app-config.entity';
import { MetaConnectionService } from './meta-connection.service';
import { MetaOauthService } from './meta-oauth.service';
import { MetaPublishService } from './meta-publish.service';
import { MetaController } from './meta.controller';
import { MetaConnectionsController } from './meta-connections.controller';
import { MetaPublishController } from './meta-publish.controller';

/**
 * Integración con redes sociales (Meta: Facebook + Instagram).
 *
 * La conexión OAuth es por rubro: cada rubro conecta su propia cuenta. Guarda
 * los tokens cifrados y publica productos en la Página/IG elegida por el rubro.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			MetaConnectionEntity,
			MetaTargetEntity,
			MetaAppConfigEntity,
			RubroEntity,
			ProductoEntity,
		]),
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
