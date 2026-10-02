import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { DireccionDto } from './pedido.dto';

/** Desde dónde despacha el rubro (origen de los envíos). */
export class DespachoDto extends DireccionDto {
	@ApiProperty({ example: 'Ferretería Sur' })
	@IsString()
	@MinLength(2)
	@MaxLength(80)
	nombre!: string;

	@ApiProperty({ example: '3515550101' })
	@IsString()
	@MinLength(6)
	@MaxLength(30)
	telefono!: string;
}

/** Bulto por defecto (cm y gramos). */
export class PaqueteDto {
	@ApiProperty({ example: 30 })
	@IsInt()
	@Min(1)
	@Max(300)
	largo!: number;

	@ApiProperty({ example: 20 })
	@IsInt()
	@Min(1)
	@Max(300)
	ancho!: number;

	@ApiProperty({ example: 15 })
	@IsInt()
	@Min(1)
	@Max(300)
	alto!: number;

	@ApiProperty({ example: 1000, description: 'Gramos.' })
	@IsInt()
	@Min(1)
	@Max(100000)
	peso!: number;
}
import { AppPlatform, IMAGE_FOCUS_RE, PEDIDOS_DESTINOS, RubroStatus, type PedidosDestino } from '@base-template/shared';

export class UpdateRubroDto {
	@ApiProperty({ required: false, example: 'Bienes Raíces' })
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
	@IsString()
	imageUrl?: string;

	@ApiProperty({ required: false, nullable: true, example: '30% 50%', description: 'Punto de foco de la portada (CSS object-position).' })
	@IsOptional()
	@Matches(IMAGE_FOCUS_RE)
	imageFocus?: string | null;

	@ApiProperty({ required: false, type: [String], description: 'Categorías del catálogo, en el orden del menú de la tienda.' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(60)
	@IsString({ each: true })
	@MaxLength(40, { each: true })
	categorias?: string[];

	@ApiProperty({ required: false, enum: PEDIDOS_DESTINOS, description: 'Quién recibe los pedidos de la tienda.' })
	@IsOptional()
	@IsIn(PEDIDOS_DESTINOS)
	pedidosDestino?: PedidosDestino;

	@ApiProperty({ required: false, nullable: true, example: '5493511234567', description: 'WhatsApp propio del rubro.' })
	@IsOptional()
	@IsString()
	@MaxLength(30)
	whatsapp?: string | null;

	@ApiProperty({ required: false, nullable: true, example: 'mi.negocio.mp', description: 'Alias para transferir.' })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	pagoAlias?: string | null;

	@ApiProperty({ required: false, nullable: true, description: 'CBU/CVU para transferir.' })
	@IsOptional()
	@IsString()
	@MaxLength(30)
	pagoCbu?: string | null;

	@ApiProperty({ required: false, nullable: true, description: 'Titular de la cuenta.' })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	pagoTitular?: string | null;

	@ApiProperty({ required: false, nullable: true, type: DespachoDto, description: 'Dirección de despacho (origen de los envíos).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => DespachoDto)
	despacho?: DespachoDto | null;

	@ApiProperty({ required: false, nullable: true, type: PaqueteDto, description: 'Bulto para productos sin medidas.' })
	@IsOptional()
	@ValidateNested()
	@Type(() => PaqueteDto)
	paqueteDefault?: PaqueteDto | null;

	@ApiProperty({ required: false, nullable: true, description: 'Token de la cuenta PROPIA de envia.com. null o "" = usar la de la plataforma.' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	enviaToken?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	logoUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	instagramUrl?: string;

	@ApiProperty({ enum: AppPlatform, isArray: true, required: false })
	@IsOptional()
	@IsArray()
	@IsEnum(AppPlatform, { each: true })
	platforms?: AppPlatform[];

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	androidUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	iosUrl?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	webUrl?: string;

	@ApiProperty({ enum: RubroStatus, required: false })
	@IsOptional()
	@IsEnum(RubroStatus)
	status?: RubroStatus;

	@ApiProperty({ required: false, description: 'Habilita el tab de suscripciones del rubro en la vitrina.' })
	@IsOptional()
	@IsBoolean()
	subscriptionsEnabled?: boolean;
}

/** Renombrar (o borrar, con `to` vacío) una categoría del rubro y sus productos. */
export class RenameCategoriaDto {
	@ApiProperty({ example: 'Herramientas' })
	@IsString()
	@MinLength(1)
	@MaxLength(40)
	from!: string;

	@ApiProperty({ required: false, example: 'Herramientas manuales', description: 'Vacío o ausente = borrar la categoría.' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	to?: string;
}
