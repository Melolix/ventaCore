import { Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlConnectionService } from './ml-connection.service';
import { MlOauthService } from './ml-oauth.service';

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

	/** Arranca el OAuth con la app de plataforma: devuelve la URL de consentimiento. */
	@Post('connect')
	connect(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		const espacioId = espacioDe(user);
		const creds = this.connections.getAppCredentials();
		const state = this.oauth.signState({ rubroId, espacioId });
		return { url: this.oauth.buildAuthUrl(creds.appId, state) };
	}

	/** Desconecta la cuenta de Mercado Libre del rubro. */
	@Delete()
	disconnect(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.connections.disconnect(rubroId, espacioDe(user));
	}
}
