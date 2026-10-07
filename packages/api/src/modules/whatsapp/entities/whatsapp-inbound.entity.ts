import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un mensaje ENTRANTE de WhatsApp (la respuesta del dueño/CM). Se guarda crudo
 * para log y, sobre todo, para DEDUPE: Meta reintenta los webhooks, así que
 * `waMessageId` (wamid del entrante) es UNIQUE para procesar cada mensaje una vez.
 *
 * `contextWamid` es el `context.id` del mensaje citado: apunta al `waMessageId`
 * de un `whatsapp_notifications`, y así se resuelve a qué pregunta/rubro responder.
 * Si viene null (respondió sin citar) no se puede rutear → queda con
 * status='unrouted' y se le pide al usuario que cite el aviso.
 */
@Entity('whatsapp_inbound')
export class WhatsappInboundEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** `wamid` del mensaje entrante. UNIQUE → dedupe de reintentos de Meta. */
	@Index({ unique: true })
	@Column()
	waMessageId!: string;

	/** `wa_id` de quien escribió (para matchear el destinatario; ver nota MLA del 549/54). */
	@Index()
	@Column()
	fromWaId!: string;

	/** `context.id`: wamid del aviso citado. null si respondió sin citar. */
	@Index()
	@Column({ type: 'varchar', nullable: true })
	contextWamid!: string | null;

	/** Texto de la respuesta (lo que se publicará en ML). */
	@Column({ type: 'text', nullable: true })
	text!: string | null;

	/**
	 * Estado del procesamiento:
	 * 'received' | 'processed' (respuesta publicada en ML) | 'unrouted' (sin cita
	 * o cita desconocida) | 'ignored' (no es texto / duplicado) | 'failed'.
	 */
	@Column({ default: 'received' })
	status!: string;

	/** Detalle si no se pudo procesar. */
	@Column({ type: 'text', nullable: true })
	error!: string | null;

	/** Snapshot crudo del mensaje entrante, para depurar. */
	@Column({ type: 'jsonb', nullable: true })
	raw!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;
}
