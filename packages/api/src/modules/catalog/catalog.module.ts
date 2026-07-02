import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { RubroEntity } from './entities/rubro.entity';
import { ProductoEntity } from './entities/producto.entity';
import { RubrosService } from './rubros.service';
import { ProductosService } from './productos.service';
import { RubrosController } from './rubros.controller';
import { ProductosController } from './productos.controller';
import { PublicController } from './public.controller';

@Module({
	imports: [TypeOrmModule.forFeature([RubroEntity, ProductoEntity]), UsersModule],
	controllers: [RubrosController, ProductosController, PublicController],
	providers: [RubrosService, ProductosService, FirebaseAuthGuard, RolesGuard],
	exports: [RubrosService, ProductosService],
})
export class CatalogModule {}
