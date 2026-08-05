import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ML_LISTING_TYPES, ProductoSource, type MlListingType, type ProductoAtributos } from '@base-template/shared';

export class CreateProductoDto {
	@ApiProperty({ example: 'Departamento 2 ambientes' })
	@IsString()
	@MinLength(2)
	nombre!: string;

	@ApiProperty({ required: false, example: 'Con balcón y cochera.' })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ required: false, example: 120000 })
	@IsOptional()
	@IsNumber()
	@Min(0)
	precio?: number;

	@ApiProperty({ required: false, example: 80000, description: 'Precio de costo (proveedor).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	precioCosto?: number;

	@ApiProperty({ required: false, example: 50, description: 'Margen % sobre el costo (arma el precio de tienda).' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	margen?: number;

	@ApiProperty({ required: false, example: 135000, description: 'Precio en Mercado Libre.' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	precioMl?: number;

	@ApiProperty({ required: false, enum: ML_LISTING_TYPES, example: 'gold_special' })
	@IsOptional()
	@IsIn(ML_LISTING_TYPES)
	mlListingType?: MlListingType;

	@ApiProperty({ required: false, example: 'https://.../producto.png' })
	@IsOptional()
	@IsString()
	imageUrl?: string;

	@ApiProperty({ required: false, type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	imagenes?: string[];

	@ApiProperty({ required: false, example: 'usuario' })
	@IsOptional()
	@IsString()
	seccion?: string;

	// ── Campos comerciales / Mercado Libre ──

	@ApiProperty({ required: false, example: 'SKU-001' })
	@IsOptional()
	@IsString()
	sku?: string;

	@ApiProperty({ required: false, example: '7790001234567' })
	@IsOptional()
	@IsString()
	gtin?: string;

	@ApiProperty({ required: false, example: 60 })
	@IsOptional()
	@IsInt()
	@Min(0)
	stock?: number;

	@ApiProperty({ required: false, example: 20, description: 'Alto del paquete (cm), para envío ML.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	alto?: number;

	@ApiProperty({ required: false, example: 15, description: 'Ancho del paquete (cm).' })
	@IsOptional()
	@IsInt()
	@Min(0)
	ancho?: number;

	@ApiProperty({ required: false, example: 30, description: 'Largo del paquete (cm).' })
	@IsOptional()
	@IsInt()
	@Min(0)
	largo?: number;

	@ApiProperty({ required: false, example: 1000, description: 'Peso del paquete (gramos).' })
	@IsOptional()
	@IsInt()
	@Min(0)
	peso?: number;

	@ApiProperty({ required: false, example: 'MLA1234' })
	@IsOptional()
	@IsString()
	mlCategoryId?: string;

	@ApiProperty({ required: false, example: 'Alimentos › Aceites' })
	@IsOptional()
	@IsString()
	mlCategoryName?: string;

	@ApiProperty({ required: false, example: 'MLA18500846' })
	@IsOptional()
	@IsString()
	mlCatalogProductId?: string;

	@ApiProperty({ required: false, example: { BRAND: 'Natura' } })
	@IsOptional()
	@IsObject()
	atributos?: ProductoAtributos;

	@ApiProperty({ required: false, enum: ProductoSource })
	@IsOptional()
	@IsEnum(ProductoSource)
	source?: ProductoSource;

	@ApiProperty({ required: false, example: false })
	@IsOptional()
	@IsBoolean()
	isDraft?: boolean;
}
