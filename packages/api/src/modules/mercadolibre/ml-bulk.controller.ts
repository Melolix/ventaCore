import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsUUID } from 'class-validator';
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

/** Pausar / reactivar varias publicaciones a la vez. */
class BulkStatusDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayMaxSize(1000)
	@IsUUID('all', { each: true })
	ids!: string[];

	@ApiProperty({ enum: ['active', 'paused'] })
	@IsIn(['active', 'paused'])
	status!: 'active' | 'paused';
}

/** Entrar o salir del modo vacaciones. */
class VacationDto {
	@ApiProperty()
	@IsBoolean()
	on!: boolean;
}

/** Acciones en lote sobre las publicaciones de Mercado Libre de un negocio. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml')
export class MlBulkController {
	constructor(private readonly publisher: MlPublishService) {}

	@Post('bulk-status')
	bulkStatus(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Body() dto: BulkStatusDto) {
		return this.publisher.setStatusMany(rubroId, espacioDe(user), dto.ids, dto.status);
	}

	@Post('vacation')
	vacation(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Body() dto: VacationDto) {
		return this.publisher.setVacation(rubroId, espacioDe(user), dto.on);
	}
}
