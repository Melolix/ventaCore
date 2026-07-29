import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Credenciales de la **app de Mercado Libre propia de cada rubro** (modelo BYO).
 *
 * Cada negocio crea su propia app en developers.mercadolibre.com.ar y carga acá
 * su App ID (client_id) + Client Secret. Con eso VentaCore arma el OAuth y el
 * intercambio de tokens contra ESA app. El secret se guarda cifrado; nunca se
 * serializa. Una config por rubro.
 */
@Entity('ml_app_configs')
export class MlAppConfigEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro dueño de la app. Único: una config por rubro. */
	@Index({ unique: true })
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** App ID / client_id (público). */
	@Column()
	appId!: string;

	/** Client Secret, CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	appSecret!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
