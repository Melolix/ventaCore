import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BatchProductoResult } from '@base-template/shared';
import { ProductoEntity } from './entities/producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { BatchProductoItemDto } from './dto/batch-productos.dto';
import { RubrosService } from './rubros.service';

@Injectable()
export class ProductosService {
	constructor(
		@InjectRepository(ProductoEntity)
		private readonly repo: Repository<ProductoEntity>,
		private readonly rubros: RubrosService,
	) {}

	/** Lista los productos de un rubro, validando que el rubro sea del espacio. */
	async findByRubro(rubroId: string, espacioId: string): Promise<ProductoEntity[]> {
		await this.rubros.findOne(rubroId, espacioId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' } });
	}

	/** Todos los productos del espacio (de cualquier rubro) para la carga masiva. */
	findAllByEspacio(espacioId: string): Promise<ProductoEntity[]> {
		return this.repo
			.createQueryBuilder('p')
			.innerJoin('p.rubro', 'r')
			.where('r.espacioId = :espacioId', { espacioId })
			.orderBy('p.createdAt', 'DESC')
			.getMany();
	}

	private async findOwned(id: string, rubroId: string, espacioId: string): Promise<ProductoEntity> {
		await this.rubros.findOne(rubroId, espacioId);
		const producto = await this.repo.findOne({ where: { id, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado');
		return producto;
	}

	async create(rubroId: string, espacioId: string, dto: CreateProductoDto): Promise<ProductoEntity> {
		await this.rubros.findOne(rubroId, espacioId);
		const entity = this.repo.create({ ...dto, rubroId });
		return this.repo.save(entity);
	}

	async update(id: string, rubroId: string, espacioId: string, dto: UpdateProductoDto): Promise<ProductoEntity> {
		const producto = await this.findOwned(id, rubroId, espacioId);
		Object.assign(producto, dto);
		return this.repo.save(producto);
	}

	async remove(id: string, rubroId: string, espacioId: string): Promise<void> {
		const producto = await this.findOwned(id, rubroId, espacioId);
		await this.repo.remove(producto);
	}

	/**
	 * Alta/edición masiva. Procesa fila por fila con éxito parcial: guarda las
	 * válidas y reporta las que fallan (mismo orden que la entrada). Valida que
	 * cada rubro pertenezca al espacio, cacheando la validación por rubroId.
	 */
	async batchUpsert(espacioId: string, items: BatchProductoItemDto[]): Promise<BatchProductoResult[]> {
		const rubrosOk = new Map<string, boolean>();
		const results: BatchProductoResult[] = [];

		for (let index = 0; index < items.length; index++) {
			const { id, rubroId, ...fields } = items[index];
			try {
				// Valida (y cachea) que el rubro sea del espacio del usuario.
				if (!rubrosOk.has(rubroId)) {
					await this.rubros.findOne(rubroId, espacioId);
					rubrosOk.set(rubroId, true);
				}

				let saved: ProductoEntity;
				if (id) {
					const producto = await this.repo.findOne({ where: { id, rubroId } });
					if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
					Object.assign(producto, fields);
					saved = await this.repo.save(producto);
				} else {
					saved = await this.repo.save(this.repo.create({ ...fields, rubroId }));
				}
				results.push({ index, ok: true, id: saved.id, error: null });
			} catch (e: unknown) {
				const error = e instanceof Error ? e.message : 'Error al guardar el producto';
				results.push({ index, ok: false, id: null, error });
			}
		}

		return results;
	}

	/** Público: productos de un rubro activo (404 si el rubro no es público). */
	async findPublicByRubro(rubroId: string): Promise<ProductoEntity[]> {
		await this.rubros.findPublicOne(rubroId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' } });
	}
}
