import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { MlSizeChartRowInput } from '@base-template/shared';
import { SizeChartCellDto } from './create-size-chart.dto';

/** Nuevo nombre de una guía de talles (lo único general que ML deja editar). */
export class RenameSizeChartDto {
	@ApiProperty({ description: 'Nombre de la guía (máx. 60, solo letras, números y espacios).' })
	@IsString()
	@MinLength(1)
	@MaxLength(60)
	name!: string;
}

/** Celdas de un talle: para sumar un talle nuevo o corregir las medidas de uno. */
export class SizeChartRowInputDto implements MlSizeChartRowInput {
	@ApiProperty({ type: [SizeChartCellDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => SizeChartCellDto)
	attributes!: SizeChartCellDto[];
}
