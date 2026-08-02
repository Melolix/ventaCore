import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

/** El visitante inicia la suscripción a un plan desde la vitrina. */
export class CreateCheckoutDto {
	@ApiProperty({ example: 'b3f1c2a4-...', description: 'Id del plan al que se suscribe.' })
	@IsUUID()
	planId!: string;

	@ApiProperty({ example: 'cliente@ejemplo.com' })
	@IsEmail()
	email!: string;

	@ApiProperty({ required: false, example: 'Juan Pérez' })
	@IsOptional()
	@IsString()
	name?: string;
}
