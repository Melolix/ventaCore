import { BadRequestException, Controller, ForbiddenException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, ML_LISTING_TYPES, Role, type MlListingType } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlCatalogService } from './ml-catalog.service';
import { MlPricingService } from './ml-pricing.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Valida y normaliza el tipo de publicación (default Clásica). */
function listingTypeDe(value?: string): MlListingType {
	const lt = (value || 'gold_special') as MlListingType;
	if (!ML_LISTING_TYPES.includes(lt)) throw new BadRequestException('Tipo de publicación inválido');
	return lt;
}

/** Consultas al catálogo de ML (categorías, atributos, productos) para la carga masiva. */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml')
export class MlCatalogController {
	constructor(
		private readonly catalog: MlCatalogService,
		private readonly pricing: MlPricingService,
	) {}

	/** Comisión de ML para un precio (para el desglose en vivo de la calculadora). */
	@Get('fee')
	fee(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('price') price = '',
		@Query('categoryId') categoryId = '',
		@Query('listingType') listingType?: string,
	) {
		return this.pricing.getFee(rubroId, espacioDe(user), Number(price), categoryId, listingTypeDe(listingType));
	}

	/** Sugiere el precio de ML para dejar un neto objetivo (costo + margen) intacto. */
	@Get('suggest-price')
	suggestPrice(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('neto') neto = '',
		@Query('categoryId') categoryId = '',
		@Query('listingType') listingType?: string,
	) {
		return this.pricing.suggestPrice(rubroId, espacioDe(user), Number(neto), categoryId, listingTypeDe(listingType));
	}

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
