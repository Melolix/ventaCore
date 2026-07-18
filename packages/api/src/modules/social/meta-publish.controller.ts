import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MetaPublishService } from './meta-publish.service';
import { PublishProductoDto } from './dto/publish-producto.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Publica un producto en las redes de Meta del rubro. */
@ApiTags('meta')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/productos/:productoId')
export class MetaPublishController {
	constructor(private readonly publish: MetaPublishService) {}

	@Post('publish')
	publicar(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('productoId') productoId: string,
		@Body() dto: PublishProductoDto,
	) {
		return this.publish.publishProducto(productoId, rubroId, espacioDe(user), dto);
	}
}
