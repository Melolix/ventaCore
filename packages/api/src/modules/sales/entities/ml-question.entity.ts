import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Una pregunta que un comprador hizo en una publicación de Mercado Libre. Es la
 * fuente del panel de Preguntas; se responde desde la app (POST /answers a ML) y
 * se refleja acá.
 *
 * `mlQuestionId` es único → idempotencia del upsert cuando ML reenvía el webhook.
 */
@Entity('ml_questions')
export class MlQuestionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (cuenta de ML) dueño de la publicación preguntada. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Id de la pregunta en ML. Único → idempotencia del upsert. */
	@Index({ unique: true })
	@Column()
	mlQuestionId!: string;

	/** Id de la publicación (item) sobre la que se preguntó. */
	@Index()
	@Column()
	mlItemId!: string;

	/** Texto de la pregunta. */
	@Column({ type: 'text' })
	text!: string;

	/** Estado en ML: 'UNANSWERED' | 'ANSWERED' | 'CLOSED_UNANSWERED' | 'BANNED' | ... */
	@Column()
	status!: string;

	/** Texto de la respuesta (null si todavía no se respondió). */
	@Column({ type: 'text', nullable: true })
	answerText!: string | null;

	/** Id del comprador que preguntó (ML restringe cada vez más los datos personales). */
	@Column({ type: 'varchar', nullable: true })
	fromId!: string | null;

	@Column({ type: 'timestamptz', nullable: true })
	dateCreated!: Date | null;

	@Column({ type: 'timestamptz', nullable: true })
	answeredAt!: Date | null;

	/** Snapshot crudo de la pregunta de ML, para depuración. */
	@Column({ type: 'jsonb', nullable: true })
	raw!: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
