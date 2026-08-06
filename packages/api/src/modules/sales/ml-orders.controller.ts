import { Controller, ForbiddenException, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlOrdersService } from './ml-orders.service';
import { MlShipmentsService, type LabelFormat } from './ml-shipments.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Panel de ventas concretadas de Mercado Libre para un rubro. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml/orders')
export class MlOrdersController {
	constructor(
		private readonly orders: MlOrdersService,
		private readonly shipments: MlShipmentsService,
	) {}

	/** Lista las ventas del rubro (filtro opcional por estado). */
	@Get()
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('status') status?: string,
		@Query('limit') limit?: string,
		@Query('offset') offset?: string,
	) {
		return this.orders.list(rubroId, espacioDe(user), {
			status: status || undefined,
			limit: limit ? Number(limit) : undefined,
			offset: offset ? Number(offset) : undefined,
		});
	}

	/** Sincroniza (backfill) el historial de ventas pagadas desde Mercado Libre. */
	@Post('sync')
	sync(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.orders.backfill(rubroId, espacioDe(user));
	}

	/** Baja la etiqueta de envío de una venta (PDF o ZPL para impresora térmica). */
	@Get(':orderId/label')
	async label(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('orderId') orderId: string,
		@Res() res: Response,
		@Query('format') format?: string,
	) {
		const fmt: LabelFormat = format === 'zpl' ? 'zpl' : 'pdf';
		const label = await this.shipments.getLabel(rubroId, espacioDe(user), orderId, fmt);
		res.set({
			'Content-Type': label.contentType,
			'Content-Disposition': `attachment; filename="${label.filename}"`,
		});
		res.send(label.buffer);
	}
}
