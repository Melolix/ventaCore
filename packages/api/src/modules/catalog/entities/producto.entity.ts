import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { RubroEntity } from './rubro.entity';

/** TypeORM devuelve `numeric` como string; lo convertimos a number. */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

@Entity('productos')
export class ProductoEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column('uuid')
	rubroId!: string;

	@ManyToOne(() => RubroEntity, rubro => rubro.productos, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'rubroId' })
	rubro!: RubroEntity;

	@Column()
	nombre!: string;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
	precio!: number | null;

	@Column({ type: 'varchar', nullable: true })
	imageUrl!: string | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
