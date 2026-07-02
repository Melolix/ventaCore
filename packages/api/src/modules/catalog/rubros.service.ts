import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RubroStatus } from '@base-template/shared';
import { RubroEntity } from './entities/rubro.entity';
import { CreateRubroDto } from './dto/create-rubro.dto';
import { UpdateRubroDto } from './dto/update-rubro.dto';

@Injectable()
export class RubrosService {
	constructor(
		@InjectRepository(RubroEntity)
		private readonly repo: Repository<RubroEntity>,
	) {}

	findByOwner(ownerId: string): Promise<RubroEntity[]> {
		return this.repo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
	}

	/** Busca un rubro validando que pertenezca al admin dueño. */
	async findOne(id: string, ownerId: string): Promise<RubroEntity> {
		const rubro = await this.repo.findOne({ where: { id, ownerId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	create(ownerId: string, dto: CreateRubroDto): Promise<RubroEntity> {
		const entity = this.repo.create({ ...dto, ownerId });
		return this.repo.save(entity);
	}

	async update(id: string, ownerId: string, dto: UpdateRubroDto): Promise<RubroEntity> {
		const rubro = await this.findOne(id, ownerId);
		Object.assign(rubro, dto);
		return this.repo.save(rubro);
	}

	async remove(id: string, ownerId: string): Promise<void> {
		const rubro = await this.findOne(id, ownerId);
		await this.repo.remove(rubro);
	}

	// ── Público (sin dueño): solo rubros activos ──

	/** Rubros activos de todos los admins, con el conteo de productos. */
	findPublicActivos(): Promise<RubroEntity[]> {
		return this.repo
			.createQueryBuilder('rubro')
			.loadRelationCountAndMap('rubro.productCount', 'rubro.productos')
			.where('rubro.status = :status', { status: RubroStatus.ACTIVE })
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
