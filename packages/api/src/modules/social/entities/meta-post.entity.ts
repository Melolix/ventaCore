import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { MetaNetwork, MetaPostKind } from '@base-template/shared';

/**
 * Una publicación concretada en las redes de Meta (Instagram/Facebook). Se
 * guarda al publicar desde el Estudio para armar el historial ("Publicaciones
 * recientes"). La `imageUrl` es la imagen ya compuesta con la plantilla.
 */
@Entity('meta_posts')
export class MetaPostEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Rubro (marca) dueño de la publicación. */
	@Index()
	@Column('uuid')
	rubroId!: string;

	/** Espacio (tenant) del rubro. Denormalizado para el scoping por negocio. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	/** Producto del que salió el post (si lo hubo). */
	@Column({ type: 'uuid', nullable: true })
	productoId!: string | null;

	/** Red donde se publicó. */
	@Column()
	network!: MetaNetwork;

	/**
	 * Post al feed o Historia. Las historias expiran a las 24 h: la fila queda
	 * igual, pero el estudio la muestra como vencida a partir de `createdAt`.
	 */
	@Column({ default: 'post' })
	kind!: MetaPostKind;

	/** Imagen compuesta publicada (URL pública en Storage). */
	@Column({ type: 'text' })
	imageUrl!: string;

	/** Texto del posteo. */
	@Column({ type: 'text', nullable: true })
	caption!: string | null;

	/** ID del media/post en la red. */
	@Column({ type: 'varchar', nullable: true })
	mediaId!: string | null;

	/** Link público al post (si se pudo obtener). */
	@Column({ type: 'varchar', nullable: true })
	permalink!: string | null;

	/** Estado de la publicación (por ahora siempre 'published'). */
	@Column({ default: 'published' })
	status!: string;

	@CreateDateColumn()
	createdAt!: Date;
}
