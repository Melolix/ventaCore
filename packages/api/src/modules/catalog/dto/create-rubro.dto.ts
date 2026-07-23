import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AppPlatform, RubroStatus } from '@base-template/shared';

export class CreateRubroDto {
	@ApiProperty({ example: 'Bienes Raíces' })
	@IsString()
	@MinLength(2)
	nombre!: string;

	@ApiProperty({ required: false, example: 'Propiedades de lujo y desarrollos urbanos.' })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ required: false, example: 'https://.../portada.jpg' })
	@IsOptional()
	@IsString()
	imageUrl?: string;

	@ApiProperty({ required: false, example: 'https://.../logo.png' })
	@IsOptional()
	@IsString()
	logoUrl?: string;

	@ApiProperty({ required: false, example: 'https://instagram.com/el.negocio' })
	@IsOptional()
	@IsString()
	instagramUrl?: string;

	@ApiProperty({ enum: AppPlatform, isArray: true, required: false, example: [AppPlatform.ANDROID, AppPlatform.IOS] })
	@IsOptional()
	@IsArray()
	@IsEnum(AppPlatform, { each: true })
	platforms?: AppPlatform[];

	@ApiProperty({ required: false, example: 'https://play.google.com/store/apps/details?id=com.melolix.app' })
	@IsOptional()
	@IsString()
	androidUrl?: string;

	@ApiProperty({ required: false, example: 'https://apps.apple.com/app/id000000000' })
	@IsOptional()
	@IsString()
	iosUrl?: string;

	@ApiProperty({ required: false, example: 'https://app.miempresa.com' })
	@IsOptional()
	@IsString()
	webUrl?: string;

	@ApiProperty({ enum: RubroStatus, required: false, default: RubroStatus.DRAFT })
	@IsOptional()
	@IsEnum(RubroStatus)
	status?: RubroStatus;
}
