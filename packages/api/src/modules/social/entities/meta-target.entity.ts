import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { MetaConnectionEntity } from './meta-connection.entity';

/**
 * Un destino publicable de una conexión Meta: una Página de Facebook y, si
 * tiene una vinculada, su cuenta de Instagram Business.
 *
 * Guarda el token de Página **cifrado** (con él se publica en el feed de la
 * Página y, vía la cuenta IG vinculada, en Instagram). Se borra en cascada al
 * eliminarse la conexión.
 */
@Entity('meta_targets')
export class MetaTargetEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Index()
	@Column('uuid')
	connectionId!: string;

	@ManyToOne(() => MetaConnectionEntity, connection => connection.targets, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'connectionId' })
	connection!: MetaConnectionEntity;

	/** ID de la Página de Facebook. */
	@Column()
	pageId!: string;

	/** Nombre de la Página (para mostrar en el panel). */
	@Column()
	pageName!: string;

	/** Token de acceso de la Página, CIFRADO (AES-256-GCM). */
	@Column({ type: 'text' })
	pageAccessToken!: string;

	/** Cuenta de Instagram Business vinculada a la Página, o null. */
	@Column({ type: 'varchar', nullable: true })
	igBusinessAccountId!: string | null;

	/** Usuario de Instagram (ej: minegocio), o null. */
	@Column({ type: 'varchar', nullable: true })
	igUsername!: string | null;

	/** Habilitado por el admin para publicar. */
	@Column({ default: false })
	enabled!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
