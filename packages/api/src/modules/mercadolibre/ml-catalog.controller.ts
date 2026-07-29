import { Controller, ForbiddenException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlCatalogService } from './ml-catalog.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Consultas al catálogo de ML (categorías, atributos, productos) para la carga masiva. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml')
export class MlCatalogController {
	constructor(private readonly catalog: MlCatalogService) {}

	/** Predice categorías de ML a partir del título del producto. */
	@Get('categories/predict')
	predict(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Query('q') q = '') {
		return this.catalog.predictCategory(rubroId, espacioDe(user), q);
	}

	/** Atributos obligatorios de una categoría de ML. */
	@Get('categories/:categoryId/attributes')
	attributes(@Param('categoryId') categoryId: string) {
		return this.catalog.getCategoryAttributes(categoryId);
	}

	/** Busca productos en el catálogo de ML (por nombre o EAN). */
	@Get('catalog/search')
	search(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Query('q') q = '') {
		return this.catalog.searchCatalog(rubroId, espacioDe(user), q);
	}

	/** Trae un producto del catálogo listo para autocompletar una fila. */
	@Get('catalog/:productId')
	catalogProduct(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('productId') productId: string,
	) {
		return this.catalog.getCatalogProduct(rubroId, espacioDe(user), productId);
	}
}
