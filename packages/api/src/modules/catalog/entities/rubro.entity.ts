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

	/** UID de Firebase del admin dueño del rubro (no es UUID, es string de Firebase). */
	@Index()
	@Column()
	ownerId!: string;

	@Column()
	nombre!: string;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	@Column({ type: 'varchar', nullable: true })
	imageUrl!: string | null;

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
