import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { EspacioType } from '@base-template/shared';

export class UpdateEspacioDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MinLength(2)
	nombre?: string;

	@ApiProperty({ enum: EspacioType, required: false })
	@IsOptional()
	@IsEnum(EspacioType)
	type?: EspacioType;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	logoUrl?: string;

	@ApiProperty({ required: false, example: 'mitienda.com' })
	@IsOptional()
	@IsString()
	domain?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	active?: boolean;

	/** Habilitación de canales por el superadmin: { [canal]: boolean }. */
	@ApiProperty({ required: false, additionalProperties: { type: 'boolean' } })
	@IsOptional()
	@IsObject()
	channels?: Record<string, boolean>;
}
