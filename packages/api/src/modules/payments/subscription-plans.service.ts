import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProvider, SubscriptionInterval, type SubscriptionPlan } from '@base-template/shared';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class SubscriptionPlansService {
	constructor(
		@InjectRepository(SubscriptionPlanEntity)
		private readonly plans: Repository<SubscriptionPlanEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
	) {}

	/** Planes de un rubro (para el panel del admin). Valida el espacio. */
	async listByRubro(rubroId: string, espacioId: string): Promise<SubscriptionPlan[]> {
		await this.assertRubro(rubroId, espacioId);
		const rows = await this.plans.find({ where: { rubroId }, order: { orden: 'ASC', createdAt: 'ASC' } });
		return rows.map(SubscriptionPlansService.toPublic);
	}

	async create(rubroId: string, espacioId: string, dto: CreatePlanDto): Promise<SubscriptionPlan> {
		await this.assertRubro(rubroId, espacioId);
		const plan = this.plans.create({
			rubroId,
			espacioId,
			nombre: dto.nombre.trim(),
			descripcion: dto.descripcion?.trim() || null,
			precio: dto.precio,
			moneda: dto.moneda?.trim() || 'USD',
			intervalo: dto.intervalo ?? SubscriptionInterval.MONTH,
			provider: dto.provider ?? PaymentProvider.LEMON_SQUEEZY,
			providerVariantId: dto.providerVariantId?.trim() || null,
			active: dto.active ?? true,
			orden: dto.orden ?? 0,
		});
		return SubscriptionPlansService.toPublic(await this.plans.save(plan));
	}

	async update(planId: string, rubroId: string, espacioId: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
		await this.assertRubro(rubroId, espacioId);
		const plan = await this.plans.findOne({ where: { id: planId, rubroId, espacioId } });
		if (!plan) throw new NotFoundException('Plan no encontrado');

		if (dto.nombre !== undefined) plan.nombre = dto.nombre.trim();
		if (dto.descripcion !== undefined) plan.descripcion = dto.descripcion.trim() || null;
		if (dto.precio !== undefined) plan.precio = dto.precio;
		if (dto.moneda !== undefined) plan.moneda = dto.moneda.trim() || 'USD';
		if (dto.intervalo !== undefined) plan.intervalo = dto.intervalo;
		if (dto.provider !== undefined) plan.provider = dto.provider;
		if (dto.providerVariantId !== undefined) plan.providerVariantId = dto.providerVariantId.trim() || null;
		if (dto.active !== undefined) plan.active = dto.active;
		if (dto.orden !== undefined) plan.orden = dto.orden;

		return SubscriptionPlansService.toPublic(await this.plans.save(plan));
	}

	async remove(planId: string, rubroId: string, espacioId: string): Promise<void> {
		await this.assertRubro(rubroId, espacioId);
		const res = await this.plans.delete({ id: planId, rubroId, espacioId });
		if (!res.affected) throw new NotFoundException('Plan no encontrado');
	}

	// ── Helpers ──

	private async assertRubro(rubroId: string, espacioId: string): Promise<RubroEntity> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	static toPublic(entity: SubscriptionPlanEntity): SubscriptionPlan {
		return {
			id: entity.id,
			rubroId: entity.rubroId,
			espacioId: entity.espacioId,
			nombre: entity.nombre,
			descripcion: entity.descripcion,
			precio: entity.precio,
			moneda: entity.moneda,
			intervalo: entity.intervalo,
			provider: entity.provider,
			providerVariantId: entity.providerVariantId,
			active: entity.active,
			orden: entity.orden,
			createdAt: entity.createdAt.toISOString(),
			updatedAt: entity.updatedAt.toISOString(),
		};
	}
}
