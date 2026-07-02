import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateProductoDto {
	@ApiProperty({ required: false, example: 'Departamento 2 ambientes' })
	@IsOptional()
	@IsString()
	@MinLength(2)
	nombre?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	precio?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	imageUrl?: string;
}
