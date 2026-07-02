import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@ApiTags('productos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/productos')
export class ProductosController {
	constructor(private readonly productos: ProductosService) {}

	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.productos.findByRubro(rubroId, user.uid);
	}

	@Post()
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Body() dto: CreateProductoDto,
	) {
		return this.productos.create(rubroId, user.uid, dto);
	}

	@Patch(':id')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('id') id: string,
		@Body() dto: UpdateProductoDto,
	) {
		return this.productos.update(id, rubroId, user.uid, dto);
	}

	@Delete(':id')
	remove(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('id') id: string,
	) {
		return this.productos.remove(id, rubroId, user.uid);
	}
}
