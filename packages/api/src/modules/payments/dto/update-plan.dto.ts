import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PaymentProvider, SubscriptionInterval } from '@base-template/shared';

export class UpdatePlanDto {
	@ApiProperty({ required: false })
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
	@IsNumber()
	@Min(0)
	precio?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	moneda?: string;

	@ApiProperty({ enum: SubscriptionInterval, required: false })
	@IsOptional()
	@IsEnum(SubscriptionInterval)
	intervalo?: SubscriptionInterval;

	@ApiProperty({ enum: PaymentProvider, required: false })
	@IsOptional()
	@IsEnum(PaymentProvider)
	provider?: PaymentProvider;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	providerVariantId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	active?: boolean;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	orden?: number;
}
