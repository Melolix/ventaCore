import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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

	@ApiProperty({ required: false, example: 'https://.../producto.png' })
	@IsOptional()
	@IsString()
	imageUrl?: string;
}
