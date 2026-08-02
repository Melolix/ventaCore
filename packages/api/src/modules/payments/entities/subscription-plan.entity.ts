import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentProvider, SubscriptionInterval } from '@base-template/shared';

/** TypeORM devuelve `numeric` como string; lo convertimos a number. */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null): number => (value === null ? 0 : parseFloat(value)),
};

/**
 * Un plan de suscripción que ofrece un rubro. Un rubro puede tener varios
 * (ej. Básico/Pro, mensual/anual). Cada plan mapea a un objeto del proveedor
 * (el `variant` de Lemon Squeezy) vía `providerVariantId`.
 */
@Entity('subscription_plans')
export class SubscriptionPlanEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro que ofrece el plan. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	@Column()
	nombre!: string;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	/** Precio de referencia para mostrar en la vitrina (el cobro real lo fija el proveedor). */
	@Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
	precio!: number;

	@Column({ default: 'USD' })
	moneda!: string;

	@Column({ type: 'enum', enum: SubscriptionInterval, default: SubscriptionInterval.MONTH })
	intervalo!: SubscriptionInterval;

	@Column({ type: 'enum', enum: PaymentProvider, default: PaymentProvider.LEMON_SQUEEZY })
	provider!: PaymentProvider;

	/** Id del variant (LS) / plan (MP) al que mapea. Sin esto no se puede cobrar. */
	@Column({ type: 'varchar', nullable: true })
	providerVariantId!: string | null;

	@Column({ default: true })
	active!: boolean;

	/** Orden de aparición en la vitrina. */
	@Column({ type: 'int', default: 0 })
	orden!: number;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
