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
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { PEDIDO_ENTREGAS, PEDIDO_STATUSES, type PedidoEntrega, type PedidoStatus } from '@base-template/shared';

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
