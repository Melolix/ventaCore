import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RubroStatus } from '@base-template/shared';
import { RubroEntity } from './entities/rubro.entity';
import { ProductoEntity } from './entities/producto.entity';
import { CreateRubroDto } from './dto/create-rubro.dto';
import { UpdateRubroDto } from './dto/update-rubro.dto';

/** Limpia la lista: sin vacíos ni repetidos (sin distinguir mayúsculas), respetando el orden. */
function normalizeCategorias(list: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of list) {
		const name = raw.trim();
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
}

@Injectable()
export class RubrosService {
	constructor(
		@InjectRepository(RubroEntity)
		private readonly repo: Repository<RubroEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
	) {}

	findByEspacio(espacioId: string): Promise<RubroEntity[]> {
		return this.repo.find({ where: { espacioId }, order: { createdAt: 'DESC' } });
	}

	/** Busca un rubro validando que pertenezca al espacio dado. */
	async findOne(id: string, espacioId: string): Promise<RubroEntity> {
		const rubro = await this.repo.findOne({ where: { id, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	create(espacioId: string, dto: CreateRubroDto): Promise<RubroEntity> {
		const entity = this.repo.create({ ...dto, espacioId });
		return this.repo.save(entity);
	}

	async update(id: string, espacioId: string, dto: UpdateRubroDto): Promise<RubroEntity> {
		const rubro = await this.findOne(id, espacioId);
		Object.assign(rubro, dto);
		if (dto.categorias) rubro.categorias = normalizeCategorias(dto.categorias);
		return this.repo.save(rubro);
	}

	/**
	 * Renombra una categoría (o la borra, con `to` vacío) en la lista del rubro Y
	 * en sus productos, para que no queden apuntando al nombre viejo. Si `to` ya
	 * existe, las dos se fusionan. Los productos de una categoría borrada quedan
	 * sin categoría ("Otros" en la tienda).
	 */
	async renameCategoria(id: string, espacioId: string, from: string, to?: string): Promise<RubroEntity> {
		const rubro = await this.findOne(id, espacioId);
		const target = (to ?? '').trim();
		const next = (rubro.categorias ?? []).map(c => (c === from ? target : c));
		rubro.categorias = normalizeCategorias(next);
		await this.productos.update({ rubroId: id, seccion: from }, { seccion: target || null });
		return this.repo.save(rubro);
	}

	/**
	 * Suma a la lista del rubro las categorías nuevas que aparecen al guardar
	 * productos (el vendedor las escribe en la carga masiva): así entran al menú
	 * de la tienda sin un paso aparte. Van al final; el orden se ajusta en Rubros.
	 */
	async addCategorias(id: string, names: Iterable<string>): Promise<void> {
		const rubro = await this.repo.findOne({ where: { id } });
		if (!rubro) return;
		const next = normalizeCategorias([...(rubro.categorias ?? []), ...names]);
		if (next.length === (rubro.categorias ?? []).length) return;
		await this.repo.update({ id }, { categorias: next });
	}

	async remove(id: string, espacioId: string): Promise<void> {
		const rubro = await this.findOne(id, espacioId);
		await this.repo.remove(rubro);
	}

	// ── Público: solo rubros activos de un espacio ──

	/** Rubros activos de un espacio, con el conteo de productos. */
	findPublicByEspacio(espacioId: string): Promise<RubroEntity[]> {
		return this.repo
			.createQueryBuilder('rubro')
			.loadRelationCountAndMap('rubro.productCount', 'rubro.productos')
			.where('rubro.espacioId = :espacioId', { espacioId })
			.andWhere('rubro.status = :status', { status: RubroStatus.ACTIVE })
			.orderBy('rubro.createdAt', 'DESC')
			.getMany();
	}

	/** Un rubro activo (404 si no existe o está en borrador). */
	async findPublicOne(id: string): Promise<RubroEntity> {
		const rubro = await this.repo.findOne({ where: { id, status: RubroStatus.ACTIVE } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}
}
