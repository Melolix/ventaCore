import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AppPlatform, RubroStatus } from '@base-template/shared';

export class UpdateRubroDto {
	@ApiProperty({ required: false, example: 'Bienes Raíces' })
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
	@IsString()
	imageUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	logoUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	instagramUrl?: string;

	@ApiProperty({ enum: AppPlatform, isArray: true, required: false })
	@IsOptional()
	@IsArray()
	@IsEnum(AppPlatform, { each: true })
	platforms?: AppPlatform[];

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	androidUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	iosUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	webUrl?: string;

	@ApiProperty({ enum: RubroStatus, required: false })
	@IsOptional()
	@IsEnum(RubroStatus)
	status?: RubroStatus;
}
