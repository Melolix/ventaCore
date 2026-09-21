import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A quién le avisamos por WhatsApp las preguntas de un rubro. UN destinatario por
 * rubro (el dueño O el CM, no ambos) → `rubroId` es UNIQUE.
 *
 * El número de WhatsApp Business que ENVÍA es único de plataforma (Cloud API, en
 * el entorno); acá guardamos a quién se le manda. El ruteo de la RESPUESTA no usa
 * este número: usa el mensaje citado (ver `whatsapp_notifications.waMessageId`),
 * porque un mismo celular (CM) puede recibir avisos de varios rubros.
 */
@Entity('whatsapp_recipients')
export class WhatsappRecipientEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (cuenta de ML) dueño de las preguntas. UNIQUE: un destinatario por rubro. */
	@Index({ unique: true })
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Teléfono en formato E.164 tal como lo cargó el admin (ej: +5493511234567). */
	@Column()
	phoneE164!: string;

	/**
	 * `wa_id` con el que Meta identifica al contacto en los webhooks. OJO (MLA):
	 * Meta suele devolverlo SIN el "9" (549… → 54…), así que para matchear un
	 * entrante conviene comparar contra este valor normalizado, no contra `phoneE164`.
	 */
	@Index()
	@Column({ type: 'varchar', nullable: true })
	waId!: string | null;

	/** Rol del destinatario, solo informativo: 'dueño' | 'cm' | ... */
	@Column({ type: 'varchar', nullable: true })
	role!: string | null;

	/** Nombre para mostrar en el panel (opcional). */
	@Column({ type: 'varchar', nullable: true })
	displayName!: string | null;

	/** Si está activo (se le manda) o pausado. */
	@Column({ default: true })
	active!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
