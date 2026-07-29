import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { CreateProductoDto } from './create-producto.dto';

/** Una fila del alta masiva: campos de producto + rubro destino (+ id si es update). */
export class BatchProductoItemDto extends CreateProductoDto {
	@ApiProperty({ required: false, description: 'Si viene, se actualiza ese producto; si no, se crea.' })
	@IsOptional()
	@IsUUID()
	id?: string;

	@ApiProperty({ description: 'Rubro (categoría interna) al que va el producto.' })
	@IsString()
	rubroId!: string;
}

/** Payload del alta/edición masiva de productos. */
export class BatchProductosDto {
	@ApiProperty({ type: [BatchProductoItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(500)
	@ValidateNested({ each: true })
	@Type(() => BatchProductoItemDto)
	items!: BatchProductoItemDto[];
}
