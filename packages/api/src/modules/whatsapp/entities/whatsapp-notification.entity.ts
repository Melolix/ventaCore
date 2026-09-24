import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Un aviso saliente de WhatsApp: "tenés algo nuevo para responder" (una pregunta
 * de Mercado Libre o un DM de Instagram). Es la pieza central del RUTEO: guardamos
 * el `waMessageId` (wamid) que devuelve Meta al enviar, y cuando el destinatario
 * RESPONDE citando ese mensaje, el entrante trae `context.id === waMessageId` → así
 * resolvemos a qué origen/rubro pertenece la respuesta, sin depender del número (un
 * CM comparte celular entre varios rubros).
 *
 * `waMessageId` es UNIQUE → idempotencia y lookup de ruteo O(1).
 */
@Entity('whatsapp_notifications')
export class WhatsappNotificationEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro dueño del origen avisado. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Tipo de origen del aviso: 'ml_question' | 'ig_dm'. Decide a dónde va la respuesta. */
	@Column({ default: 'ml_question' })
	kind!: string;

	/**
	 * Id interno (uuid) del origen: `ml_questions.id` para 'ml_question' o
	 * `instagram_messages.id` para 'ig_dm'. Con `kind` se despacha la respuesta.
	 */
	@Index()
	@Column('uuid')
	sourceId!: string;

	/** Destinatario al que se le mandó (uuid de whatsapp_recipients). */
	@Column('uuid')
	recipientId!: string;

	/**
	 * `wamid` que devuelve Meta al enviar el mensaje. CLAVE DE RUTEO: la respuesta
	 * citada trae este id en `context.id`. UNIQUE. null solo si el envío falló.
	 */
	@Index({ unique: true })
	@Column({ type: 'varchar', nullable: true })
	waMessageId!: string | null;

	/**
	 * Estado del envío/entrega:
	 * 'pending' (creado, aún no enviado) | 'sent' | 'delivered' | 'read' |
	 * 'answered' (ya se publicó la respuesta en ML) | 'failed'.
	 */
	@Column({ default: 'pending' })
	status!: string;

	/** Mensaje de error si el envío falló (código/detalle de Meta). */
	@Column({ type: 'text', nullable: true })
	error!: string | null;

	/** Snapshot de la respuesta de Meta al enviar, para depurar. */
	@Column({ type: 'jsonb', nullable: true })
	raw!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
