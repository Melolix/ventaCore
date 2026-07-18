import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** El admin elige a qué destino (Página/IG) publica el rubro. */
export class SetTargetDto {
	@ApiProperty({ description: 'Id del MetaTarget elegido' })
	@IsUUID()
	metaTargetId!: string;
}
