import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SpacesModule } from '../spaces/spaces.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { RubroEntity } from './entities/rubro.entity';
import { ProductoEntity } from './entities/producto.entity';
import { PedidoEntity } from './entities/pedido.entity';
import { PedidosService } from './pedidos.service';
import { EnviaService } from './envia.service';
import { PedidosController } from './pedidos.controller';
import { RubrosService } from './rubros.service';
import { ProductosService } from './productos.service';
import { RubrosController } from './rubros.controller';
import { ProductosController } from './productos.controller';
import { ProductosBatchController } from './productos-batch.controller';
import { PublicController } from './public.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubroEntity, ProductoEntity, PedidoEntity]), UsersModule, SpacesModule],
	controllers: [RubrosController, ProductosController, ProductosBatchController, PedidosController, PublicController],
	providers: [RubrosService, ProductosService, PedidosService, EnviaService, FirebaseAuthGuard, RolesGuard],
	exports: [RubrosService, ProductosService],
})
export class CatalogModule {}
