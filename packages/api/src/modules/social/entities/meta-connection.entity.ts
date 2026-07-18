import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { MetaConnectionStatus } from '@base-template/shared';
import { MetaTargetEntity } from './meta-target.entity';

/**
 * Conexión OAuth de un rubro (marca) con Meta (Facebook + Instagram). Una por
 * rubro: cada rubro conecta su propia cuenta de Meta.
 *
 * Guarda el token de usuario long-lived (~60 días) **cifrado**. De él derivan
 * los tokens de Página de cada `MetaTargetEntity`. Nunca se serializa el token
 * hacia el frontend: la vista pública es `MetaConnection` (sin secretos).
 */
@Entity('meta_connections')
export class MetaConnectionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (marca) dueño de la conexión. Único: una conexión por rubro. */
	@Index({ unique: true })
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** ID del usuario de Meta que otorgó el consentimiento. */
	@Column({ type: 'varchar', nullable: true })
	metaUserId!: string | null;

	/** Nombre de la cuenta de Meta (para mostrar en el panel). */
	@Column({ type: 'varchar', nullable: true })
	metaUserName!: string | null;

	/** Token de usuario long-lived, CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	userAccessToken!: string;

	/** Vencimiento del token long-lived. Si pasa, el estado va a EXPIRED. */
	@Column({ type: 'timestamptz', nullable: true })
	tokenExpiresAt!: Date | null;

	/** Permisos otorgados (guardados como texto separado por comas). */
	@Column({ type: 'simple-array', default: '' })
	scopes!: string[];

	@Column({ type: 'enum', enum: MetaConnectionStatus, default: MetaConnectionStatus.CONNECTED })
	status!: MetaConnectionStatus;

	@OneToMany(() => MetaTargetEntity, target => target.connection, { cascade: true })
	targets!: MetaTargetEntity[];

	@CreateDateColumn()
	createdAt!: Date;

	/** Se actualiza en cada (re)conexión exitosa. */
	@UpdateDateColumn()
	updatedAt!: Date;
}
