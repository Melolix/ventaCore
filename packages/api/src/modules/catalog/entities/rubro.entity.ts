import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { RubroStatus } from '@base-template/shared';
import { ProductoEntity } from './producto.entity';

@Entity('rubros')
export class RubroEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Espacio (negocio) al que pertenece el rubro. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	@Column()
	nombre!: string;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	@Column({ type: 'varchar', nullable: true })
	imageUrl!: string | null;

	/** Logo/marca propia del rubro (se muestra junto al título en la vitrina). */
	@Column({ type: 'varchar', nullable: true })
	logoUrl!: string | null;

	/** Instagram propio del rubro (cada rubro es un negocio distinto). */
	@Column({ type: 'varchar', nullable: true })
	instagramUrl!: string | null;

	/**
	 * Destino de publicación en Meta: id del `MetaTargetEntity` (Página FB + IG)
	 * elegido dentro de la conexión de este rubro. null si aún no eligió cuenta.
	 * Columna uuid plana (sin FK entre módulos), igual que `espacioId`.
	 */
	@Index()
	@Column({ type: 'uuid', nullable: true })
	metaTargetId!: string | null;

	@Column({ type: 'enum', enum: RubroStatus, default: RubroStatus.DRAFT })
	status!: RubroStatus;

	@OneToMany(() => ProductoEntity, producto => producto.rubro)
	productos!: ProductoEntity[];

	/** No es columna: lo llena `loadRelationCountAndMap` en las consultas públicas. */
	productCount?: number;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
