import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { EspaciosService } from '../spaces/espacios.service';
import { RubrosService } from './rubros.service';
import { ProductosService } from './productos.service';
import { PedidosService } from './pedidos.service';
import { CotizarEnvioDto, CreatePedidoDto } from './dto/pedido.dto';

/**
 * Endpoints públicos (sin autenticación) de la vitrina de cada negocio. El negocio
 * se resuelve por el hostname del navegador (dominio propio o subdominio en dev).
 */
@ApiTags('public')
@Controller('public')
export class PublicController {
	constructor(
		private readonly espacios: EspaciosService,
		private readonly rubros: RubrosService,
		private readonly productos: ProductosService,
		private readonly pedidos: PedidosService,
	) {}

	/** Vitrina del negocio del dominio actual: sus datos + rubros activos. */
	@Get('site')
	@ApiQuery({ name: 'host', example: 'campo-ruta.localhost' })
	async site(@Query('host') host: string) {
		const espacio = await this.espacios.resolveByHost(host);
		const rubros = await this.rubros.findPublicByEspacio(espacio.id);
		return { espacio, rubros };
	}

	/** Un rubro activo (para el encabezado del detalle). */
	@Get('rubros/:id')
	rubro(@Param('id') id: string) {
		return this.rubros.findPublicOne(id);
	}

	/** Opciones de envío (transportista, precio, plazo) para el carrito y la dirección del cliente. */
	@Post('rubros/:id/envios/cotizar')
	@HttpCode(200)
	cotizarEnvio(@Param('id') id: string, @Body() dto: CotizarEnvioDto) {
		return this.pedidos.cotizarPublic(id, dto);
	}

	/** El cliente envía su pedido (carrito) a la tienda de un rubro. */
	@Post('rubros/:id/pedidos')
	crearPedido(@Param('id') id: string, @Body() dto: CreatePedidoDto) {
		return this.pedidos.createPublic(id, dto);
	}

	/** Seguimiento del pedido para el cliente (link con token). */
	@Get('pedidos/:token')
	pedido(@Param('token') token: string) {
		return this.pedidos.findPublicByToken(token);
	}

	/** Productos de un rubro activo. */
	@Get('rubros/:id/productos')
	productosDeRubro(@Param('id') id: string) {
		return this.productos.findPublicByRubro(id);
	}
}
