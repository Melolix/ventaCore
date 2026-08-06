import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Log de las notificaciones (webhooks) que Mercado Libre manda a la app de
 * plataforma. Cumple dos funciones:
 *  - **Auditoría/depuración**: guarda el payload crudo de cada aviso.
 *  - **Trazabilidad**: `status` + `error` dejan ver qué se procesó, qué se
 *    ignoró (sin rubro / app ajena) y qué falló.
 *
 * La idempotencia REAL del negocio (no descontar stock dos veces) NO vive acá:
 * vive en `ml_orders.stockApplied`. ML reenvía el mismo aviso varias veces (con
 * `attempts` creciente); acá se loguean todos a propósito.
 */
@Entity('ml_notifications')
export class MlNotificationEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Topic de ML: 'orders_v2' | 'shipments' | 'questions' | 'items' | ... */
	@Index()
	@Column()
	topic!: string;

	/** Recurso afectado, tal cual lo manda ML (ej. '/orders/2000012345'). */
	@Column()
	resource!: string;

	/** user_id del vendedor en ML (dueño del recurso). Llave para resolver el rubro. */
	@Index()
	@Column({ type: 'varchar', nullable: true })
	mlUserId!: string | null;

	/** Rubro resuelto a partir de `mlUserId` (null si ninguna conexión matchea). */
	@Index()
	@Column({ type: 'uuid', nullable: true })
	rubroId!: string | null;

	/** application_id de ML (para verificar que el aviso es de nuestra app). */
	@Column({ type: 'varchar', nullable: true })
	applicationId!: string | null;

	/** Nº de intento que informa ML (reintenta si no recibe 200 a tiempo). */
	@Column({ type: 'integer', nullable: true })
	attempts!: number | null;

	/** Momento en que ML dice haber enviado el aviso. */
	@Column({ type: 'timestamptz', nullable: true })
	mlSentAt!: Date | null;

	/**
	 * Estado del procesamiento:
	 *  - 'received'  : persistido, todavía sin procesar.
	 *  - 'processed' : el handler del topic lo procesó ok.
	 *  - 'ignored'   : no aplicaba (sin rubro, topic sin handler, app ajena).
	 *  - 'failed'    : el handler tiró error (ver `error`).
	 */
	@Column({ type: 'varchar', default: 'received' })
	status!: string;

	/** Mensaje de error si `status` = 'failed'. */
	@Column({ type: 'text', nullable: true })
	error!: string | null;

	/** Payload crudo del webhook, para depurar. */
	@Column({ type: 'jsonb', nullable: true })
	payload!: Record<string, unknown> | null;

	@CreateDateColumn()
	receivedAt!: Date;

	/** Cuándo terminó de procesarse (ok o error). */
	@Column({ type: 'timestamptz', nullable: true })
	processedAt!: Date | null;
}
