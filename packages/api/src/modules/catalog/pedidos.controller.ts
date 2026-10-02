import { Body, Controller, ForbiddenException, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PedidosService } from './pedidos.service';
import { UpdatePedidoStatusDto } from './dto/pedido.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Pedidos de la tienda de un rubro, para el vendedor (panel). */
@ApiTags('pedidos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/pedidos')
export class PedidosController {
	constructor(private readonly pedidos: PedidosService) {}

	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.pedidos.findByRubro(rubroId, espacioDe(user));
	}

	/** Aceptar, rechazar, registrar pago/entrega o cancelar. */
	@Patch(':id/status')
	updateStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('id') id: string,
		@Body() dto: UpdatePedidoStatusDto,
	) {
		return this.pedidos.updateStatus(id, rubroId, espacioDe(user), dto.status, dto.motivo);
	}
}
