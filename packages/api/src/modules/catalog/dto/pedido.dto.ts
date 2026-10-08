import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { PEDIDO_ENTREGAS, PEDIDO_STATUSES, PROVINCIA_CODES, type PedidoEntrega, type PedidoStatus } from '@base-template/shared';

/** Dirección postal argentina (destino del envío o despacho del rubro). */
export class DireccionDto {
	@ApiProperty({ example: 'Av. Colón' })
	@IsString()
	@MinLength(2)
	@MaxLength(80)
	calle!: string;

	@ApiProperty({ example: '1234' })
	@IsString()
	@MinLength(1)
	@MaxLength(12)
	numero!: string;

	@ApiProperty({ example: 'Córdoba' })
	@IsString()
	@MinLength(2)
	@MaxLength(60)
	ciudad!: string;

	@ApiProperty({ example: 'X', description: 'Código de provincia (ISO 3166-2 sin "AR-").' })
	@IsIn(PROVINCIA_CODES)
	provincia!: string;

	@ApiProperty({ example: '5000' })
	@IsString()
	@Matches(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/)
	cp!: string;

	@ApiProperty({ required: false, example: 'Piso 2, depto B' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	referencia?: string;
}

export class CreatePedidoItemDto {
	@ApiProperty()
	@IsUUID()
	productoId!: string;

	@ApiProperty({ example: 2 })
	@IsInt()
	@Min(1)
	@Max(999)
	cantidad!: number;
}

/** Cotización de envío desde el carrito. */
export class CotizarEnvioDto {
	@ApiProperty({ type: DireccionDto })
	@ValidateNested()
	@Type(() => DireccionDto)
	destino!: DireccionDto;

	@ApiProperty({ type: [CreatePedidoItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => CreatePedidoItemDto)
	items!: CreatePedidoItemDto[];
}

/** Pedido que arma el cliente en la vitrina. Los precios los resuelve el servidor. */
export class CreatePedidoDto {
	@ApiProperty({ example: 'Juan Pérez' })
	@IsString()
	@MinLength(2)
	@MaxLength(80)
	clienteNombre!: string;

	@ApiProperty({ example: '351 555 0101' })
	@IsString()
	@MinLength(6)
	@MaxLength(30)
	clienteTelefono!: string;

	@ApiProperty({ enum: PEDIDO_ENTREGAS })
	@IsIn(PEDIDO_ENTREGAS)
	entrega!: PedidoEntrega;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	direccion?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notas?: string;

	@ApiProperty({ type: [CreatePedidoItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => CreatePedidoItemDto)
	items!: CreatePedidoItemDto[];

	@ApiProperty({ required: false, type: DireccionDto, description: 'Dirección estructurada (envío cotizado).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => DireccionDto)
	destino?: DireccionDto;

	@ApiProperty({ required: false, example: 'andreani:ground', description: 'Opción de envío elegida (carrier:service).' })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	envioId?: string;
}

/** Cambio de estado que hace el vendedor desde el panel. */
export class UpdatePedidoStatusDto {
	@ApiProperty({ enum: PEDIDO_STATUSES })
	@IsIn(PEDIDO_STATUSES)
	status!: PedidoStatus;

	@ApiProperty({ required: false, description: 'Motivo para el cliente (al rechazar o cancelar).' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	motivo?: string;
}
