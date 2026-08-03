import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlPublishService } from './ml-publish.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Cambio de estado de una publicación: pausar / reactivar. */
class SetStatusDto {
	@ApiProperty({ enum: ['active', 'paused'] })
	@IsIn(['active', 'paused'])
	status!: 'active' | 'paused';
}

/** Publicación de productos en Mercado Libre. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml/productos/:productoId')
export class MlPublishController {
	constructor(private readonly publisher: MlPublishService) {}

	@Post('publish')
	publish(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('productoId') productoId: string,
	) {
		return this.publisher.publish(rubroId, espacioDe(user), productoId);
	}

	/** Sincroniza el precio/stock de una publicación existente con la app. */
	@Post('update')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('productoId') productoId: string,
	) {
		return this.publisher.updateListing(rubroId, espacioDe(user), productoId);
	}

	/** Pausa o reactiva la publicación en Mercado Libre. */
	@Post('status')
	setStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('productoId') productoId: string,
		@Body() dto: SetStatusDto,
	) {
		return this.publisher.setStatus(rubroId, espacioDe(user), productoId, dto.status);
	}
}
