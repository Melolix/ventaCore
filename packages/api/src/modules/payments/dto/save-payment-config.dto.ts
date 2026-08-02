import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from '@base-template/shared';

/**
 * Guarda (upsert) las credenciales del proveedor de un espacio. Los secretos
 * (`apiKey`, `webhookSecret`) son opcionales: si no vienen, se conservan los ya
 * guardados (así el panel no necesita re-pedirlos para editar otros campos).
 */
export class SavePaymentConfigDto {
	@ApiProperty({ enum: PaymentProvider, example: PaymentProvider.LEMON_SQUEEZY })
	@IsEnum(PaymentProvider)
	provider!: PaymentProvider;

	@ApiProperty({ required: false, example: 'ls_api_key_...' })
	@IsOptional()
	@IsString()
	apiKey?: string;

	@ApiProperty({ required: false, example: '123456' })
	@IsOptional()
	@IsString()
	storeId?: string;

	@ApiProperty({ required: false, example: 'whsec_...' })
	@IsOptional()
	@IsString()
	webhookSecret?: string;

	@ApiProperty({ required: false, default: true })
	@IsOptional()
	@IsBoolean()
	active?: boolean;
}
