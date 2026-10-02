import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { AppPlatform, RubroStatus, type PedidosDestino } from '@base-template/shared';
import { ProductoEntity } from './producto.entity';

@Entity('rubros')
export class RubroEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Espacio (negocio) al que pertenece el rubro. */
	@Index()
	@Column('uuid')
	espacioId!: string;

	@Column()
	nombre!: string;

	@Column({ type: 'text', nullable: true })
	descripcion!: string | null;

	@Column({ type: 'varchar', nullable: true })
	imageUrl!: string | null;

	/**
	 * Punto de foco de la portada ("x% y%", CSS object-position). La portada es 3:1
	 * y en el celu se muestra casi cuadrada: el recorte se centra acá. null = centro.
	 */
	@Column({ type: 'varchar', nullable: true })
	imageFocus!: string | null;

	/**
	 * Categorías del catálogo, EN ORDEN (es el orden del menú de la tienda). Cada
	 * producto apunta a una por nombre en `producto.seccion`; los que no tienen
	 * (o tienen una que ya no está en la lista) van a "Otros", al final.
	 */
	@Column({ type: 'jsonb', default: [] })
	categorias!: string[];

	/**
	 * Quién recibe los pedidos de la tienda de este rubro: 'cm' = el WhatsApp
	 * general del espacio (lo lleva el community manager); 'negocio' = el WhatsApp
	 * propio del rubro (`whatsapp`). Si es 'negocio' pero no cargó número, cae al
	 * del espacio.
	 */
	@Column({ type: 'varchar', default: 'cm' })
	pedidosDestino!: PedidosDestino;

	/** WhatsApp propio del rubro (para recibir los pedidos cuando los lleva el negocio). */
	@Column({ type: 'varchar', nullable: true })
	whatsapp!: string | null;

	/** Logo/marca propia del rubro (se muestra junto al título en la vitrina). */
	@Column({ type: 'varchar', nullable: true })
	logoUrl!: string | null;

	/** Instagram propio del rubro (cada rubro es un negocio distinto). */
	@Column({ type: 'varchar', nullable: true })
	instagramUrl!: string | null;

	/**
	 * Destino de publicación en Meta: id del `MetaTargetEntity` (Página FB + IG)
	 * elegido dentro de la conexión de este rubro. null si aún no eligió cuenta.
	 * Columna uuid plana (sin FK entre módulos), igual que `espacioId`.
	 */
	@Index()
	@Column({ type: 'uuid', nullable: true })
	metaTargetId!: string | null;

	/** Plataformas de la app (solo espacios tipo `apps`). Definen los íconos en la vitrina. */
	@Column({ type: 'simple-array', default: '' })
	platforms!: AppPlatform[];

	/** Link de descarga en Google Play o al APK (solo espacios tipo `apps`). */
	@Column({ type: 'varchar', nullable: true })
	androidUrl!: string | null;

	/** Link de descarga en la App Store (solo espacios tipo `apps`). */
	@Column({ type: 'varchar', nullable: true })
	iosUrl!: string | null;

	/** Link para abrir la versión web/escritorio (solo espacios tipo `apps`). */
	@Column({ type: 'varchar', nullable: true })
	webUrl!: string | null;

	@Column({ type: 'enum', enum: RubroStatus, default: RubroStatus.DRAFT })
	status!: RubroStatus;

	/** Si el rubro ofrece suscripción (habilita el tab de suscripciones en la vitrina). */
	@Column({ default: false })
	subscriptionsEnabled!: boolean;

	@OneToMany(() => ProductoEntity, producto => producto.rubro)
	productos!: ProductoEntity[];

	/** No es columna: lo llena `loadRelationCountAndMap` en las consultas públicas. */
	productCount?: number;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
