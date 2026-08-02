import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentProvider } from '@base-template/shared';

/**
 * Log de webhooks recibidos del proveedor. Cumple dos funciones:
 *  - **Idempotencia**: `providerEventId` es único, así un webhook reenviado no se
 *    procesa dos veces.
 *  - **Auditoría**: guarda el payload crudo para depurar discrepancias.
 */
@Entity('subscription_events')
export class SubscriptionEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Suscripción afectada (si se pudo resolver). */
	@Index()
	@Column({ type: 'uuid', nullable: true })
	subscriptionId!: string | null;

	@Column({ type: 'enum', enum: PaymentProvider })
	provider!: PaymentProvider;

	/** Tipo de evento del proveedor (ej. `subscription_created`). */
	@Column()
	eventType!: string;

	/** Id del evento en el proveedor. Único → deduplicación. */
	@Index({ unique: true })
	@Column()
	providerEventId!: string;

	@Column({ type: 'jsonb', nullable: true })
	payload!: Record<string, unknown> | null;

	@CreateDateColumn()
	receivedAt!: Date;
}
