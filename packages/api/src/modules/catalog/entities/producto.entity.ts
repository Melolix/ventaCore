import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { ProductoSource, type ProductoAtributos } from '@base-template/shared';
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

	/** Precio de venta en la tienda propia (vitrina). costo + margen. */
	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
	precio!: number | null;

	/** Precio de costo (lo que sale del Excel/proveedor). Base para el margen. */
	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
	precioCosto!: number | null;

	/** Precio en Mercado Libre (mayor que el de tienda: absorbe la comisión de ML). */
	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
	precioMl!: number | null;

	/** Tipo de publicación en ML: gold_special (Clásica) | gold_pro (Premium). */
	@Column({ type: 'varchar', default: 'gold_special' })
	mlListingType!: string;

	@Column({ type: 'varchar', nullable: true })
	imageUrl!: string | null;

	/** Galería de imágenes (la primera es la portada). Todas se publican en ML. */
	@Column({ type: 'jsonb', default: [] })
	imagenes!: string[];

	/** Pestaña/sección (solo apps multi-audiencia, ej. usuario/entrenador/admin). */
	@Column({ type: 'varchar', nullable: true })
	seccion!: string | null;

	// ── Campos comerciales / Mercado Libre (ML-ready) ──

	/** Código interno del negocio (SKU). */
	@Column({ type: 'varchar', nullable: true })
	sku!: string | null;

	/** Código de barras / EAN (GTIN en Mercado Libre). */
	@Column({ type: 'varchar', nullable: true })
	gtin!: string | null;

	/** Stock disponible. null = sin definir. */
	@Column({ type: 'integer', nullable: true })
	stock!: number | null;

	/** Id de categoría de Mercado Libre (ej. "MLA1234"). */
	@Column({ type: 'varchar', nullable: true })
	mlCategoryId!: string | null;

	/** Path legible de la categoría, cacheado ("Alimentos › Aceites"). */
	@Column({ type: 'varchar', nullable: true })
	mlCategoryName!: string | null;

	/** Atributos de ML por id de atributo (los obligatorios varían por categoría). */
	@Column({ type: 'jsonb', nullable: true })
	atributos!: ProductoAtributos | null;

	/** De dónde salió el dato (catálogo/IA/Excel/manual). */
	@Column({ type: 'varchar', default: ProductoSource.MANUAL })
	source!: ProductoSource;

	/** Borrador: el usuario todavía no lo quiere publicar. */
	@Column({ type: 'boolean', default: false })
	isDraft!: boolean;

	/** Id de la publicación en Mercado Libre (ej. "MLA123..."), null si no se publicó. */
	@Column({ type: 'varchar', nullable: true })
	mlItemId!: string | null;

	/** Link público del aviso en Mercado Libre, o null. */
	@Column({ type: 'varchar', nullable: true })
	mlPermalink!: string | null;

	/** Estado real en Mercado Libre: 'active' | 'paused' | 'closed' | ... (null si no se publicó). */
	@Column({ type: 'varchar', nullable: true })
	mlStatus!: string | null;

	/** Id del producto de catálogo de ML al que se enlaza al publicar, o null. */
	@Column({ type: 'varchar', nullable: true })
	mlCatalogProductId!: string | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
