import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un DM (mensaje directo) ENTRANTE de Instagram, de un cliente al negocio. Se
 * guarda para avisar por WhatsApp y para poder responderlo (el CM responde citando
 * el aviso → se envía la respuesta de vuelta a este DM).
 *
 * `igMessageId` (el `mid` de Meta) es UNIQUE → dedupe de reintentos del webhook.
 * `senderId` es el IGSID del cliente: es a quién se le responde.
 */
@Entity('instagram_messages')
export class InstagramMessageEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (cuenta de IG del negocio) dueño de la conversación. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** `mid` del mensaje en Meta. UNIQUE → dedupe de reintentos del webhook. */
	@Index({ unique: true })
	@Column()
	igMessageId!: string;

	/** IGSID del cliente que escribió (a quién se le responde). */
	@Index()
	@Column()
	senderId!: string;

	/** Id de la cuenta de IG del negocio que recibió el DM (para resolver el rubro). */
	@Column({ type: 'varchar', nullable: true })
	recipientIgId!: string | null;

	/** Texto del DM (lo que se muestra en el aviso de WhatsApp). */
	@Column({ type: 'text', nullable: true })
	text!: string | null;

	/**
	 * Estado: 'received' | 'notified' (avisado por WhatsApp) | 'answered'
	 * (respondido en IG) | 'ignored' (sin texto / eco propio) | 'failed'.
	 */
	@Column({ default: 'received' })
	status!: string;

	/** Detalle si algo falló. */
	@Column({ type: 'text', nullable: true })
	error!: string | null;

	/** Snapshot crudo del mensaje entrante, para depurar. */
	@Column({ type: 'jsonb', nullable: true })
	raw!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;
}
