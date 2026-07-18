import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * Credenciales de la **app de Meta propia de cada rubro** (modelo BYO app).
 *
 * Cada negocio crea su propia app en developers.facebook.com y carga acá su
 * App ID + App Secret. Con eso VentaCore arma el OAuth y el intercambio de
 * tokens contra ESA app. El secret se guarda cifrado; nunca se serializa.
 *
 * Es previo e independiente de la conexión: existe apenas el admin carga las
 * credenciales, antes de autorizar. Una config por rubro.
 */
@Entity('meta_app_configs')
export class MetaAppConfigEntity {
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

	/** App ID (público). */
	@Column()
	appId!: string;

	/** App Secret, CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	appSecret!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
