import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EspacioType } from '@base-template/shared';

@Entity('espacios')
export class EspacioEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column()
	nombre!: string;

	/** Cómo se presenta la vitrina (catálogo comercial vs. página de apps). */
	@Column({ type: 'enum', enum: EspacioType, default: EspacioType.CATALOG })
	type!: EspacioType;

	/** Slug único (identificador; subdominio en dev: {slug}.localhost). */
	@Index({ unique: true })
	@Column()
	slug!: string;

	/** Dominio propio del negocio (ej: mitienda.com). Resuelve la vitrina por hostname. */
	@Index({ unique: true })
	@Column({ type: 'varchar', nullable: true })
	domain!: string | null;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	@Column({ type: 'varchar', nullable: true })
	logoUrl!: string | null;

	// ── Contacto y página "Sobre Nosotros" (editable por el admin del espacio) ──
	@Column({ type: 'varchar', nullable: true })
	whatsapp!: string | null;

	@Column({ type: 'varchar', nullable: true })
	instagramUrl!: string | null;

	@Column({ type: 'varchar', nullable: true })
	aboutHeadline!: string | null;

	@Column({ type: 'text', nullable: true })
	aboutText!: string | null;

	@Column({ type: 'varchar', nullable: true })
	aboutImageUrl!: string | null;

	@Column({ default: true })
	active!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
