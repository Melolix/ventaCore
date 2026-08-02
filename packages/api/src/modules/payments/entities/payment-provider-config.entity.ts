import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentProvider } from '@base-template/shared';

/**
 * Credenciales del proveedor de cobro **por espacio** (modelo BYO): cada negocio
 * conecta su propia cuenta, así su plata va directo a él.
 *
 * `apiKey` y `webhookSecret` se guardan CIFRADOS (AES-256-GCM) y nunca se
 * serializan hacia el cliente. Una config por (espacio, proveedor).
 */
@Entity('payment_provider_configs')
@Index(['espacioId', 'provider'], { unique: true })
export class PaymentProviderConfigEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Espacio (tenant) dueño de la cuenta. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	@Column({ type: 'enum', enum: PaymentProvider })
	provider!: PaymentProvider;

	/** API key del proveedor, CIFRADA. */
	@Column({ type: 'text', nullable: true })
	apiKey!: string | null;

	/** Store/collector id del negocio en el proveedor (público). */
	@Column({ type: 'varchar', nullable: true })
	storeId!: string | null;

	/** Signing secret del webhook, CIFRADO. */
	@Column({ type: 'text', nullable: true })
	webhookSecret!: string | null;

	@Column({ default: false })
	active!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
