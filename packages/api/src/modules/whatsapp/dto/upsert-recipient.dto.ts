import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** El admin define/actualiza el destinatario de WhatsApp de un rubro. */
export class UpsertRecipientDto {
	@ApiProperty({ description: 'Teléfono en formato E.164', example: '+5493511234567' })
	@Matches(/^\+[1-9]\d{7,14}$/, { message: 'El teléfono debe estar en formato E.164 (ej: +5493511234567)' })
	phoneE164!: string;

	@ApiPropertyOptional({ description: 'Rol informativo del destinatario', example: 'dueño' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	role?: string;

	@ApiPropertyOptional({ description: 'Nombre para mostrar en el panel' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	displayName?: string;

	@ApiPropertyOptional({ description: 'Si está activo (recibe avisos)', default: true })
	@IsOptional()
	@IsBoolean()
	active?: boolean;
}
