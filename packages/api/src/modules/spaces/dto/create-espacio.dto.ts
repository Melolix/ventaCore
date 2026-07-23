import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EspacioType } from '@base-template/shared';

export class CreateEspacioDto {
	@ApiProperty({ example: 'Agropecuaria del Sur' })
	@IsString()
	@MinLength(2)
	nombre!: string;

	@ApiProperty({ enum: EspacioType, required: false, default: EspacioType.CATALOG })
	@IsOptional()
	@IsEnum(EspacioType)
	type?: EspacioType;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ required: false, example: 'https://.../logo.png' })
	@IsOptional()
	@IsString()
	logoUrl?: string;

	@ApiProperty({ required: false, example: 'mitienda.com' })
	@IsOptional()
	@IsString()
	domain?: string;

	// ── Datos del admin (CM) del espacio ──
	@ApiProperty({ example: 'cm@negocio.com' })
	@IsEmail()
	adminEmail!: string;

	@ApiProperty({ example: 'clave123', minLength: 6 })
	@IsString()
	@MinLength(6)
	adminPassword!: string;
}
