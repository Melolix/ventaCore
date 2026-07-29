import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MlConnectionStatus } from '@base-template/shared';

/**
 * Conexión OAuth de un rubro con Mercado Libre. Una por rubro: cada rubro
 * conecta su propia cuenta de vendedor.
 *
 * Guarda el access token (6 h) y el **refresh token** (~6 meses), ambos
 * cifrados. El refresh token es de un solo uso: cada vez que se refresca, ML
 * devuelve uno nuevo que reemplaza al anterior. Nunca se serializan los tokens
 * hacia el frontend: la vista pública es `MlConnection` (sin secretos).
 */
@Entity('ml_connections')
export class MlConnectionEntity {
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

	/** ID del usuario/vendedor de ML que otorgó el consentimiento. */
	@Column({ type: 'varchar', nullable: true })
	mlUserId!: string | null;

	/** Nickname del vendedor en ML (para mostrar en el panel). */
	@Column({ type: 'varchar', nullable: true })
	mlNickname!: string | null;

	/** Sitio de ML del vendedor (ej. "MLA" para Argentina). */
	@Column({ type: 'varchar', nullable: true })
	siteId!: string | null;

	/** Access token (6 h), CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	accessToken!: string;

	/** Refresh token (~6 meses, un solo uso), CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	refreshToken!: string;

	/** Vencimiento del access token. Si pasa, se refresca antes de publicar. */
	@Column({ type: 'timestamptz', nullable: true })
	tokenExpiresAt!: Date | null;

	/** Permisos otorgados (guardados como texto separado por comas). */
	@Column({ type: 'simple-array', default: '' })
	scopes!: string[];

	@Column({ type: 'enum', enum: MlConnectionStatus, default: MlConnectionStatus.CONNECTED })
	status!: MlConnectionStatus;

	@CreateDateColumn()
	createdAt!: Date;

	/** Se actualiza en cada (re)conexión o refresh exitoso. */
	@UpdateDateColumn()
	updatedAt!: Date;
}
