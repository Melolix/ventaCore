import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Credenciales de la app de Mercado Libre propia del rubro (modelo BYO). */
export class SaveMlAppConfigDto {
	@ApiProperty({ description: 'App ID (client_id) de la app de Mercado Libre del negocio' })
	@IsString()
	@MinLength(4)
	@MaxLength(64)
	appId!: string;

	@ApiProperty({ description: 'Client Secret de la app de Mercado Libre del negocio' })
	@IsString()
	@MinLength(10)
	@MaxLength(128)
	appSecret!: string;
}
