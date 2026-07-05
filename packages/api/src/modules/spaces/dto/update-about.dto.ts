import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos editables por el admin de un espacio (su página "Sobre Nosotros"). */
export class UpdateAboutDto {
	@ApiProperty({ required: false, example: '5491112345678' })
	@IsOptional()
	@IsString()
	whatsapp?: string;

	@ApiProperty({ required: false, example: 'https://instagram.com/mi.negocio' })
	@IsOptional()
	@IsString()
	instagramUrl?: string;

	@ApiProperty({ required: false, example: 'Nuestra historia' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	aboutHeadline?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(10000)
	aboutText?: string;

	@ApiProperty({ required: false, example: 'https://.../foto.jpg' })
	@IsOptional()
	@IsString()
	aboutImageUrl?: string;
}
