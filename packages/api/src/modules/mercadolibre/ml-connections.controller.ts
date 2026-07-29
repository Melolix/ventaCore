import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlConnectionService } from './ml-connection.service';
import { MlOauthService } from './ml-oauth.service';
import { SaveMlAppConfigDto } from './dto/save-ml-app-config.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** El admin gestiona la conexión de Mercado Libre de cada uno de SUS rubros. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml')
export class MlConnectionsController {
	constructor(
		private readonly connections: MlConnectionService,
		private readonly oauth: MlOauthService,
	) {}

	/** Estado de ML del rubro: app configurada + conexión. */
	@Get()
	state(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.connections.stateForRubro(rubroId, espacioDe(user));
	}

	/** Carga/actualiza el App ID + Client Secret de la app de ML del rubro. */
	@Put('app')
	saveApp(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Body() dto: SaveMlAppConfigDto,
	) {
		return this.connections.saveAppConfig(rubroId, espacioDe(user), dto.appId, dto.appSecret);
	}

	/** Arranca el OAuth contra la app del rubro: devuelve la URL de consentimiento. */
	@Post('connect')
	async connect(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		const espacioId = espacioDe(user);
		const creds = await this.connections.getAppCredentials(rubroId, espacioId);
		const state = this.oauth.signState({ rubroId, espacioId });
		return { url: this.oauth.buildAuthUrl(creds.appId, state) };
	}

	/** Desconecta la cuenta de Mercado Libre del rubro. */
	@Delete()
	disconnect(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.connections.disconnect(rubroId, espacioDe(user));
	}
}
