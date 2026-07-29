import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ProductosService } from './productos.service';
import { BatchProductosDto } from './dto/batch-productos.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/**
 * Alta/edición masiva de productos (carga masiva). Va a nivel raíz porque una
 * tanda puede tocar varios rubros; cada fila lleva su propio `rubroId`.
 */
@ApiTags('productos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('productos')
export class ProductosBatchController {
	constructor(private readonly productos: ProductosService) {}

	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser) {
		return this.productos.findAllByEspacio(espacioDe(user));
	}

	@Post('batch')
	batch(@CurrentUser() user: AuthenticatedUser, @Body() dto: BatchProductosDto) {
		return this.productos.batchUpsert(espacioDe(user), dto.items);
	}
}
