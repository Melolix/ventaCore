import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, ML_LISTING_TYPES, Role, type MlListingType } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlCatalogService } from './ml-catalog.service';
import { MlPricingService } from './ml-pricing.service';
import { CreateSizeChartDto } from './dto/create-size-chart.dto';

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

	/** Cotiza el envío gratis de ML (costo que paga el vendedor + si es obligatorio). */
	@Get('shipping-cost')
	shippingCost(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('price') price = '',
		@Query('alto') alto = '',
		@Query('ancho') ancho = '',
		@Query('largo') largo = '',
		@Query('peso') peso = '',
		@Query('listingType') listingType?: string,
	) {
		const dims = { alto: Number(alto), ancho: Number(ancho), largo: Number(largo), peso: Number(peso) };
		return this.pricing.getFreeShipping(rubroId, espacioDe(user), dims, Number(price), listingTypeDe(listingType));
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

	/** Ficha técnica de la guía de talles de la categoría (qué pide ML para crearla). */
	@Get('size-charts/spec')
	sizeChartSpec(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('categoryId') categoryId = '',
		@Query('gender') gender = '',
		@Query('brand') brand = '',
	) {
		return this.catalog.getSizeChartSpec(rubroId, espacioDe(user), categoryId, gender, brand);
	}

	/** Columnas para crear una guía de talles propia (talles, medidas y datos generales). */
	@Get('size-charts/template')
	sizeChartTemplate(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('categoryId') categoryId = '',
		@Query('gender') gender = '',
		@Query('brand') brand = '',
	) {
		return this.catalog.getSizeChartTemplate(rubroId, espacioDe(user), categoryId, gender, brand);
	}

	/** Crea una guía de talles propia en la cuenta de ML del vendedor (sin salir de VentaCore). */
	@Post('size-charts')
	createSizeChart(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('categoryId') categoryId = '',
		@Body() dto: CreateSizeChartDto,
	) {
		return this.catalog.createSizeChart(rubroId, espacioDe(user), categoryId, dto);
	}

	/** Una guía de talles por su código (el que ML muestra al crearla). */
	@Get('size-charts/by-id/:chartId')
	sizeChartById(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('chartId') chartId: string,
		@Query('categoryId') categoryId = '',
	) {
		return this.catalog.getSizeChartById(rubroId, espacioDe(user), chartId, categoryId);
	}

	/** Guías de talles del vendedor para una categoría (ML las exige en ropa). */
	@Get('size-charts')
	sizeCharts(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('categoryId') categoryId = '',
		@Query('gender') gender = '',
		@Query('brand') brand = '',
	) {
		return this.catalog.getSizeCharts(rubroId, espacioDe(user), categoryId, gender, brand);
	}

	/** Atributos con los que la categoría distingue opciones de un mismo producto. */
	@Get('categories/:categoryId/variation-attributes')
	variationAttributes(@Param('categoryId') categoryId: string) {
		return this.catalog.getVariationAttributes(categoryId);
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
