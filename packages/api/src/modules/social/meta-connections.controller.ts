import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MetaConnectionService } from './meta-connection.service';
import { MetaOauthService } from './meta-oauth.service';
import { SetTargetDto } from './dto/set-target.dto';
import { SaveAppConfigDto } from './dto/save-app-config.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** El admin gestiona la conexión Meta de cada uno de SUS rubros. */
@ApiTags('meta')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/meta')
export class MetaConnectionsController {
	constructor(
		private readonly connections: MetaConnectionService,
		private readonly oauth: MetaOauthService,
	) {}

	/** Estado de Meta del rubro: app configurada + conexión. */
	@Get()
	state(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.connections.stateForRubro(rubroId, espacioDe(user));
	}

	/** Carga/actualiza el App ID + App Secret de la app de Meta del rubro. */
	@Put('app')
	saveApp(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Body() dto: SaveAppConfigDto,
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

	/** Elige a qué Página/IG publica el rubro. */
	@Patch('target')
	setTarget(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Body() dto: SetTargetDto,
	) {
		return this.connections.setTarget(rubroId, espacioDe(user), dto.metaTargetId);
	}

	/** Desconecta la cuenta de Meta del rubro. */
	@Delete()
	disconnect(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.connections.disconnect(rubroId, espacioDe(user));
	}
}
