import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateNested,
} from 'class-validator';
import type { MlCreateSizeChartInput, MlSizeChartCellInput, MlSizeChartValueInput } from '@base-template/shared';

/** Un valor de una celda: opción de lista (id), texto (name) o número + unidad. */
export class SizeChartValueDto implements MlSizeChartValueInput {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	id?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	name?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	number?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	unit?: string;
}

/** Un atributo de la guía (general o de una fila) con sus valores. */
export class SizeChartCellDto implements MlSizeChartCellInput {
	@ApiProperty()
	@IsString()
	id!: string;

	@ApiProperty({ type: [SizeChartValueDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SizeChartValueDto)
	values!: SizeChartValueDto[];
}

/** Una fila (talle) de la guía. */
export class SizeChartRowDto {
	@ApiProperty({ type: [SizeChartCellDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SizeChartCellDto)
	attributes!: SizeChartCellDto[];
}

/** Alta de una guía de talles propia (SPECIFIC) en Mercado Libre. */
export class CreateSizeChartDto implements MlCreateSizeChartInput {
	@ApiProperty({ description: 'Nombre de la guía (máx. 60, solo letras, números y espacios).' })
	@IsString()
	@MinLength(1)
	@MaxLength(60)
	name!: string;

	@ApiProperty()
	@IsString()
	@MinLength(1)
	gender!: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	brand?: string;

	@ApiProperty({ description: 'Columna que es el talle principal (ej. AR_SIZE).' })
	@IsString()
	@MinLength(1)
	mainAttributeId!: string;

	@ApiProperty({ type: [SizeChartCellDto], required: false })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SizeChartCellDto)
	attributes?: SizeChartCellDto[];

	@ApiProperty({ type: [SizeChartRowDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => SizeChartRowDto)
	rows!: SizeChartRowDto[];
}
