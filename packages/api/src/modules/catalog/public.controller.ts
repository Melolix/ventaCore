import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RubrosService } from './rubros.service';
import { ProductosService } from './productos.service';

/**
 * Endpoints públicos (sin autenticación) para el escaparate: solo exponen
 * rubros activos y sus productos. Los borradores no son accesibles.
 */
@ApiTags('public')
@Controller('public')
export class PublicController {
	constructor(
		private readonly rubros: RubrosService,
		private readonly productos: ProductosService,
	) {}

	@Get('rubros')
	rubrosActivos() {
		return this.rubros.findPublicActivos();
	}

	@Get('rubros/:id')
	rubro(@Param('id') id: string) {
		return this.rubros.findPublicOne(id);
	}

	@Get('rubros/:id/productos')
	productosDeRubro(@Param('id') id: string) {
		return this.productos.findPublicByRubro(id);
	}
}
