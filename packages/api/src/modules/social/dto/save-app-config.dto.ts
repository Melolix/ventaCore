import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Credenciales de la app de Meta propia del rubro (modelo BYO). */
export class SaveAppConfigDto {
	@ApiProperty({ description: 'App ID de la app de Meta del negocio' })
	@IsString()
	@MinLength(5)
	@MaxLength(64)
	appId!: string;

	@ApiProperty({ description: 'App Secret de la app de Meta del negocio' })
	@IsString()
	@MinLength(10)
	@MaxLength(128)
	appSecret!: string;
}
