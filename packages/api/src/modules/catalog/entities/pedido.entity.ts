import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Direccion, EnvioOpcion, PedidoEntrega, PedidoItem, PedidoStatus } from '@base-template/shared';

/** TypeORM devuelve `numeric` como string; lo convertimos a number. */
const numericTransformer = {
	to: (value: number) => value,
	from: (value: string): number => parseFloat(value),
};

/**
 * Pedido de la tienda (carrito enviado desde la vitrina). Los ítems se guardan
 * como foto del momento (nombre y precio congelados): si después cambia el
 * producto, el pedido no se altera.
 */
@Entity('pedidos')
@Index(['rubroId', 'numero'], { unique: true })
export class PedidoEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio dueño del rubro (columna plana, sin FK, igual que en el resto). */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Número correlativo dentro del rubro (#1, #2…). */
	@Column({ type: 'int' })
	numero!: number;

	/** Token del link de seguimiento del cliente (no adivinable). */
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	token!: string;

	@Column({ type: 'varchar', default: 'pendiente' })
	status!: PedidoStatus;

	@Column({ type: 'varchar' })
	clienteNombre!: string;

	@Column({ type: 'varchar' })
	clienteTelefono!: string;

	@Column({ type: 'varchar', default: 'retiro' })
	entrega!: PedidoEntrega;

	@Column({ type: 'varchar', nullable: true })
	direccion!: string | null;

	@Column({ type: 'text', nullable: true })
	notas!: string | null;

	@Column({ type: 'jsonb', default: [] })
	items!: PedidoItem[];

	/** Dirección estructurada (cuando el envío se cotizó). */
	@Column({ type: 'jsonb', nullable: true })
	destino!: Direccion | null;

	/** Opción de envío elegida. null = retiro o envío a coordinar. */
	@Column({ type: 'jsonb', nullable: true })
	envio!: EnvioOpcion | null;

	/** Costo del envío incluido en `total`. */
	@Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
	envioCosto!: number;

	/** Total a pagar: productos + envío. */
	@Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
	total!: number;

	/** Motivo que el vendedor le da al cliente al rechazar o cancelar. */
	@Column({ type: 'text', nullable: true })
	motivo!: string | null;

	/** ¿Ya se descontó el stock? (al registrar el pago; se devuelve si se cancela). */
	@Column({ default: false })
	stockDescontado!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
