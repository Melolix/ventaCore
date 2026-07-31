import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PaymentProvider, SubscriptionInterval } from '@base-template/shared';

export class CreatePlanDto {
	@ApiProperty({ example: 'Membresía Pro' })
	@IsString()
	@MinLength(2)
	nombre!: string;

	@ApiProperty({ required: false, example: 'Acceso completo con soporte prioritario.' })
	@IsOptional()
	@IsString()
	descripcion?: string;

	@ApiProperty({ example: 5000 })
	@IsNumber()
	@Min(0)
	precio!: number;

	@ApiProperty({ required: false, default: 'USD', example: 'USD' })
	@IsOptional()
	@IsString()
	moneda?: string;

	@ApiProperty({ enum: SubscriptionInterval, default: SubscriptionInterval.MONTH })
	@IsOptional()
	@IsEnum(SubscriptionInterval)
	intervalo?: SubscriptionInterval;

	@ApiProperty({ enum: PaymentProvider, default: PaymentProvider.LEMON_SQUEEZY })
	@IsOptional()
	@IsEnum(PaymentProvider)
	provider?: PaymentProvider;

	@ApiProperty({ required: false, example: '987654', description: 'Variant id de Lemon Squeezy.' })
	@IsOptional()
	@IsString()
	providerVariantId?: string;

	@ApiProperty({ required: false, default: true })
	@IsOptional()
	@IsBoolean()
	active?: boolean;

	@ApiProperty({ required: false, default: 0 })
	@IsOptional()
	@IsInt()
	orden?: number;
}
