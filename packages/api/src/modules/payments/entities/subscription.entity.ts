import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentProvider, SubscriptionStatus } from '@base-template/shared';

/** TypeORM devuelve `numeric` como string; lo convertimos a number. */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

/**
 * Registro de una suscripción concreta. Es la fuente de verdad interna del
 * estado de cobro: la crea/actualiza el flujo de webhooks del proveedor.
 *
 * `providerSubscriptionId` identifica la suscripción en el proveedor y es único
 * por proveedor (permite el upsert idempotente desde los webhooks).
 */
@Entity('subscriptions')
@Index(['provider', 'providerSubscriptionId'], { unique: true })
export class SubscriptionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Index()
	@Column('uuid')
	espacioId!: string;

	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Plan al que corresponde. Nullable por si el plan se borró después. */
	@Column({ type: 'uuid', nullable: true })
	planId!: string | null;

	@Column({ type: 'enum', enum: PaymentProvider })
	provider!: PaymentProvider;

	/** Id de la suscripción en el proveedor. null mientras está `pending`. */
	@Column({ type: 'varchar', nullable: true })
	providerSubscriptionId!: string | null;

	@Column({ type: 'varchar', nullable: true })
	providerCustomerId!: string | null;

	@Index()
	@Column()
	subscriberEmail!: string;

	@Column({ type: 'varchar', nullable: true })
	subscriberName!: string | null;

	@Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
	status!: SubscriptionStatus;

	/** Fin del período pago actual (próxima renovación). */
	@Column({ type: 'timestamptz', nullable: true })
	currentPeriodEnd!: Date | null;

	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
	precio!: number | null;

	@Column({ type: 'varchar', nullable: true })
	moneda!: string | null;

	@Column({ type: 'timestamptz', nullable: true })
	cancelledAt!: Date | null;

	/** Snapshot del último payload del proveedor (para debug/auditoría). */
	@Column({ type: 'jsonb', nullable: true })
	metadata!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
