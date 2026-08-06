import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** TypeORM devuelve `numeric` como string; lo convertimos a number. */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

/**
 * Una venta concretada en Mercado Libre (orden). Es la fuente del panel de
 * ventas Y el libro de idempotencia del descuento de stock:
 *  - El panel lee de acá.
 *  - `stockApplied` evita descontar el stock dos veces cuando ML reenvía el
 *    webhook de la misma orden.
 *
 * Los ítems de la orden se guardan en `raw` (jsonb) para arrancar simple; si más
 * adelante hace falta analítica por producto se normalizan a una tabla aparte.
 */
@Entity('ml_orders')
export class MlOrderEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (cuenta de ML) dueño de la venta. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Id de la orden en ML. Único → idempotencia del upsert. */
	@Index({ unique: true })
	@Column()
	mlOrderId!: string;

	/** Id del pack (carrito) si la orden vino agrupada con otras, o null. */
	@Column({ type: 'varchar', nullable: true })
	packId!: string | null;

	/** Estado de la orden en ML: 'paid' | 'cancelled' | 'confirmed' | ... */
	@Column()
	status!: string;

	@Column({ type: 'timestamptz', nullable: true })
	dateCreated!: Date | null;

	@Column({ type: 'timestamptz', nullable: true })
	dateClosed!: Date | null;

	@Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
	totalAmount!: number | null;

	@Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
	paidAmount!: number | null;

	@Column({ type: 'varchar', nullable: true })
	currencyId!: string | null;

	/** Nickname del comprador (ML restringe cada vez más los datos personales). */
	@Column({ type: 'varchar', nullable: true })
	buyerNickname!: string | null;

	/** Id del envío (shipment) para pedir la etiqueta. null hasta que ML lo crea. */
	@Index()
	@Column({ type: 'varchar', nullable: true })
	shippingId!: string | null;

	/** Estado del envío: 'ready_to_ship' habilita la etiqueta. */
	@Column({ type: 'varchar', nullable: true })
	shipmentStatus!: string | null;

	/** ¿Ya se descontó el stock por esta orden? Evita el doble descuento. */
	@Column({ type: 'boolean', default: false })
	stockApplied!: boolean;

	/** Snapshot crudo de la orden de ML (incluye `order_items`), para panel/depuración. */
	@Column({ type: 'jsonb', nullable: true })
	raw!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
