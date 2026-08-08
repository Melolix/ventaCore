import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlMetricsService } from './ml-metrics.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Dashboard de métricas de la cuenta de Mercado Libre de un rubro. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml/metrics')
export class MlMetricsController {
	constructor(private readonly metrics: MlMetricsService) {}

	@Get()
	get(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.metrics.getMetrics(rubroId, espacioDe(user));
	}
}
