import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductoEntity } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { RubrosService } from './rubros.service';

@Injectable()
export class ProductosService {
	constructor(
		@InjectRepository(ProductoEntity)
		private readonly repo: Repository<ProductoEntity>,
		private readonly rubros: RubrosService,
	) {}

	/** Lista los productos de un rubro, validando que el rubro sea del admin. */
	async findByRubro(rubroId: string, ownerId: string): Promise<ProductoEntity[]> {
		await this.rubros.findOne(rubroId, ownerId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' } });
	}

	private async findOwned(id: string, rubroId: string, ownerId: string): Promise<ProductoEntity> {
		await this.rubros.findOne(rubroId, ownerId);
		const producto = await this.repo.findOne({ where: { id, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado');
		return producto;
	}

	async create(rubroId: string, ownerId: string, dto: CreateProductoDto): Promise<ProductoEntity> {
		await this.rubros.findOne(rubroId, ownerId);
		const entity = this.repo.create({ ...dto, rubroId });
		return this.repo.save(entity);
	}

	async update(id: string, rubroId: string, ownerId: string, dto: UpdateProductoDto): Promise<ProductoEntity> {
		const producto = await this.findOwned(id, rubroId, ownerId);
		Object.assign(producto, dto);
		return this.repo.save(producto);
	}

	async remove(id: string, rubroId: string, ownerId: string): Promise<void> {
		const producto = await this.findOwned(id, rubroId, ownerId);
		await this.repo.remove(producto);
	}

	/** Público: productos de un rubro activo (404 si el rubro no es público). */
	async findPublicByRubro(rubroId: string): Promise<ProductoEntity[]> {
		await this.rubros.findPublicOne(rubroId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' } });
	}
}
