import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlSizeChartsService } from './ml-size-charts.service';
import { RenameSizeChartDto, SizeChartRowInputDto } from './dto/manage-size-chart.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Gestión de las guías de talles propias del vendedor (listar, editar, borrar). */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml/size-charts')
export class MlSizeChartsController {
	constructor(private readonly charts: MlSizeChartsService) {}

	/** Guías propias relacionadas con los productos del rubro. */
	@Get('mine')
	mine(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.charts.listMine(rubroId, espacioDe(user));
	}

	/** Cambia el nombre de una guía. */
	@Put(':chartId/name')
	rename(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('chartId') chartId: string,
		@Body() dto: RenameSizeChartDto,
	) {
		return this.charts.rename(rubroId, espacioDe(user), chartId, dto.name);
	}

	/** Suma un talle a una guía. */
	@Post(':chartId/rows')
	addRow(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('chartId') chartId: string,
		@Body() dto: SizeChartRowInputDto,
	) {
		return this.charts.addRow(rubroId, espacioDe(user), chartId, dto);
	}

	/** Corrige las medidas de un talle. */
	@Put(':chartId/rows/:rowId')
	updateRow(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('chartId') chartId: string,
		@Param('rowId') rowId: string,
		@Body() dto: SizeChartRowInputDto,
	) {
		return this.charts.updateRow(rubroId, espacioDe(user), chartId, rowId, dto);
	}

	/** Pide borrar una guía (ML la elimina en 24 h si nadie la usa). */
	@Delete(':chartId')
	remove(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Param('chartId') chartId: string) {
		return this.charts.remove(rubroId, espacioDe(user), chartId);
	}
}
