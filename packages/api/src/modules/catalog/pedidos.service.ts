import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
	PAQUETE_FALLBACK,
	PEDIDO_TRANSITIONS,
	formatDireccion,
	type EnvioOpcion,
	type Paquete,
	type PedidoItem,
	type PedidoPublic,
	type PedidoStatus,
} from '@base-template/shared';
import { EnviaService } from './envia.service';
import { EspaciosService } from '../spaces/espacios.service';
import { PedidoEntity } from './entities/pedido.entity';
import { ProductoEntity } from './entities/producto.entity';
import { RubroEntity } from './entities/rubro.entity';
import { RubrosService } from './rubros.service';
import { CotizarEnvioDto, CreatePedidoDto, CreatePedidoItemDto } from './dto/pedido.dto';

/** Estados en los que el cliente ya puede ver los datos para transferir. */
const PAGO_VISIBLE: PedidoStatus[] = ['confirmado', 'pagado', 'enviado', 'entregado'];

@Injectable()
export class PedidosService {
	constructor(
		@InjectRepository(PedidoEntity)
		private readonly repo: Repository<PedidoEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly rubros: RubrosService,
		private readonly espacios: EspaciosService,
		private readonly envia: EnviaService,
		private readonly dataSource: DataSource,
	) {}

	// ── Público (vitrina) ──

	/**
	 * Resuelve el carrito contra la base: el cliente solo manda ids y cantidades;
	 * el nombre y el precio los pone el servidor (no se puede "pedir más barato").
	 * Valida que cada producto sea del rubro, tenga precio y alcance el stock, y
	 * arma el bulto para cotizar el envío.
	 */
	private async resolverCarrito(
		rubro: RubroEntity,
		lineas: CreatePedidoItemDto[],
	): Promise<{ items: PedidoItem[]; subtotal: number; paquete: Paquete }> {
		// Unificamos líneas repetidas del mismo producto.
		const cantidades = new Map<string, number>();
		for (const it of lineas) cantidades.set(it.productoId, (cantidades.get(it.productoId) ?? 0) + it.cantidad);

		const encontrados = await this.productos.find({ where: { id: In([...cantidades.keys()]), rubroId: rubro.id } });
		const porId = new Map(encontrados.map(p => [p.id, p]));
		const base = rubro.paqueteDefault ?? PAQUETE_FALLBACK;

		const items: PedidoItem[] = [];
		// Bulto único aproximado: la base más grande y los productos apilados.
		const paquete: Paquete = { largo: 0, ancho: 0, alto: 0, peso: 0 };
		for (const [productoId, cantidad] of cantidades) {
			const p = porId.get(productoId);
			if (!p || p.isDraft) throw new BadRequestException('Uno de los productos ya no está disponible');
			if (p.precio == null) throw new BadRequestException(`"${p.nombre}" no tiene precio: consultalo con el vendedor`);
			if (p.stock != null && cantidad > p.stock) {
				throw new BadRequestException(p.stock === 0 ? `"${p.nombre}" se quedó sin stock` : `De "${p.nombre}" quedan ${p.stock}`);
			}
			// Con variantes (talle, color…) el pedido tiene que decir cuál es.
			const nombre = p.grupo && p.variante ? `${p.nombre} — ${p.variante}` : p.nombre;
			items.push({ productoId, nombre, precio: p.precio, cantidad, imageUrl: p.imageUrl });
			paquete.largo = Math.max(paquete.largo, p.largo ?? base.largo);
			paquete.ancho = Math.max(paquete.ancho, p.ancho ?? base.ancho);
			paquete.alto += (p.alto ?? base.alto) * cantidad;
			paquete.peso += (p.peso ?? base.peso) * cantidad;
		}
		const subtotal = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
		return { items, subtotal, paquete };
	}

	/** Opciones de envío para el carrito y la dirección del cliente (de la más barata a la más cara). */
	async cotizarPublic(rubroId: string, dto: CotizarEnvioDto): Promise<EnvioOpcion[]> {
		const rubro = await this.rubros.findActive(rubroId);
		if (!this.envia.activo(rubro)) return [];
		const { subtotal, paquete } = await this.resolverCarrito(rubro, dto.items);
		return this.envia.cotizar(rubro, dto.destino, paquete, subtotal);
	}

	/**
	 * Crea el pedido desde la vitrina. Si eligió un envío cotizado, el servidor lo
	 * RE-COTIZA y usa ese precio (el que manda el navegador no se toma).
	 */
	async createPublic(rubroId: string, dto: CreatePedidoDto): Promise<PedidoPublic> {
		const rubro = await this.rubros.findActive(rubroId);
		const { items, subtotal, paquete } = await this.resolverCarrito(rubro, dto.items);

		let envio: EnvioOpcion | null = null;
		let direccion: string | null = null;
		if (dto.entrega === 'envio') {
			if (dto.envioId && dto.destino) {
				envio = await this.envia.cotizarOpcion(rubro, dto.destino, paquete, subtotal, dto.envioId);
				if (!envio) throw new BadRequestException('Esa opción de envío ya no está disponible: volvé a cotizar');
				direccion = formatDireccion(dto.destino);
			} else {
				// Envío a coordinar con el vendedor (sin cotización).
				direccion = dto.destino ? formatDireccion(dto.destino) : dto.direccion?.trim() || null;
				if (!direccion) throw new BadRequestException('Falta la dirección para el envío');
			}
		}
		const envioCosto = envio?.precio ?? 0;
		const total = subtotal + envioCosto;

		// Número correlativo por rubro. El índice único (rubroId, numero) frena la
		// carrera entre dos pedidos simultáneos: si choca, reintentamos con el siguiente.
		for (let intento = 0; ; intento++) {
			const { max } = (await this.repo
				.createQueryBuilder('p')
				.select('MAX(p.numero)', 'max')
				.where('p.rubroId = :rubroId', { rubroId })
				.getRawOne<{ max: number | null }>()) ?? { max: null };
			try {
				const saved = await this.repo.save(
					this.repo.create({
						rubroId,
						espacioId: rubro.espacioId,
						numero: (max ?? 0) + 1,
						token: randomBytes(16).toString('hex'),
						status: 'pendiente',
						clienteNombre: dto.clienteNombre.trim(),
						clienteTelefono: dto.clienteTelefono.trim(),
						entrega: dto.entrega,
						direccion,
						destino: dto.entrega === 'envio' ? (dto.destino ?? null) : null,
						envio,
						envioCosto,
						paquete,
						notas: dto.notas?.trim() || null,
						items,
						total,
					}),
				);
				return this.toPublic(saved, rubro);
			} catch (e: unknown) {
				const duplicate = (e as { code?: string }).code === '23505';
				if (!duplicate || intento >= 3) throw e;
			}
		}
	}

	/** Seguimiento del pedido para el cliente (por el token de su link). */
	async findPublicByToken(token: string): Promise<PedidoPublic> {
		const pedido = await this.repo.findOne({ where: { token } });
		if (!pedido) throw new NotFoundException('Pedido no encontrado');
		const rubro = await this.rubros.findRaw(pedido.rubroId);
		if (!rubro) throw new NotFoundException('Pedido no encontrado');
		return this.toPublic(pedido, rubro);
	}

	/**
	 * Vista del cliente. Los datos para transferir van SOLO si el vendedor ya
	 * confirmó (evita pagos de pedidos sin stock).
	 */
	private async toPublic(pedido: PedidoEntity, rubro: RubroEntity): Promise<PedidoPublic> {
		const espacio = await this.espacios.findById(rubro.espacioId).catch(() => null);
		const own = rubro.pedidosDestino === 'negocio' ? rubro.whatsapp : null;
		const whatsapp = (own || espacio?.whatsapp || '').replace(/\D/g, '') || null;
		return {
			numero: pedido.numero,
			token: pedido.token,
			status: pedido.status,
			clienteNombre: pedido.clienteNombre,
			entrega: pedido.entrega,
			direccion: pedido.direccion,
			items: pedido.items,
			envio: pedido.envio,
			envioCosto: pedido.envioCosto,
			total: pedido.total,
			motivo: pedido.motivo,
			createdAt: pedido.createdAt.toISOString(),
			updatedAt: pedido.updatedAt.toISOString(),
			tienda: rubro.nombre,
			rubroId: rubro.id,
			whatsapp,
			pago: PAGO_VISIBLE.includes(pedido.status)
				? { alias: rubro.pagoAlias, cbu: rubro.pagoCbu, titular: rubro.pagoTitular }
				: null,
			seguimiento: pedido.etiqueta
				? { carrier: pedido.etiqueta.carrier, trackingNumber: pedido.etiqueta.trackingNumber, trackUrl: pedido.etiqueta.trackUrl }
				: null,
		};
	}

	// ── Panel (vendedor) ──

	async findByRubro(rubroId: string, espacioId: string): Promise<PedidoEntity[]> {
		await this.rubros.findOne(rubroId, espacioId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' }, take: 300 });
	}

	/** El pedido del rubro, validando que el rubro sea del espacio. */
	private async findOwned(id: string, rubroId: string, espacioId: string): Promise<{ pedido: PedidoEntity; rubro: RubroEntity }> {
		const rubro = await this.rubros.findOne(rubroId, espacioId);
		const pedido = await this.repo.findOne({ where: { id, rubroId } });
		if (!pedido) throw new NotFoundException('Pedido no encontrado');
		return { pedido, rubro };
	}

	/**
	 * Genera el envío del pedido en el transportista que eligió el cliente:
	 * guarda el número de seguimiento y la etiqueta, y pasa el pedido a "enviado".
	 * Solo con el pedido pagado y un envío cotizado. En producción descuenta saldo.
	 */
	async generarEnvio(id: string, rubroId: string, espacioId: string): Promise<PedidoEntity> {
		if (!this.envia.etiquetas) throw new BadRequestException('La generación de envíos no está habilitada');
		const { pedido, rubro } = await this.findOwned(id, rubroId, espacioId);
		if (pedido.etiqueta) throw new BadRequestException('Este pedido ya tiene un envío generado');
		if (pedido.status !== 'pagado') throw new BadRequestException('El envío se genera con el pedido pagado');
		if (!pedido.envio || !pedido.destino) throw new BadRequestException('Este pedido no tiene un envío cotizado');

		const subtotal = pedido.total - pedido.envioCosto;
		pedido.etiqueta = await this.envia.generar(rubro, {
			numero: pedido.numero,
			clienteNombre: pedido.clienteNombre,
			clienteTelefono: pedido.clienteTelefono,
			destino: pedido.destino,
			paquete: pedido.paquete ?? rubro.paqueteDefault ?? PAQUETE_FALLBACK,
			valorDeclarado: subtotal,
			carrier: pedido.envio.carrier,
			service: pedido.envio.service,
		});
		pedido.status = 'enviado';
		return this.repo.save(pedido);
	}

	/** Anula el envío generado (recupera el saldo) y el pedido vuelve a "pagado". */
	async anularEnvio(id: string, rubroId: string, espacioId: string): Promise<PedidoEntity> {
		const { pedido, rubro } = await this.findOwned(id, rubroId, espacioId);
		if (!pedido.etiqueta) throw new BadRequestException('Este pedido no tiene un envío generado');
		if (pedido.status === 'entregado') throw new BadRequestException('El pedido ya figura como entregado');
		await this.envia.cancelar(rubro, pedido.etiqueta.carrier, pedido.etiqueta.trackingNumber);
		pedido.etiqueta = null;
		pedido.status = 'pagado';
		return this.repo.save(pedido);
	}

	/**
	 * Cambia el estado del pedido respetando el flujo. Al registrar el pago se
	 * descuenta el stock; si un pedido ya pagado se cancela, se devuelve.
	 */
	async updateStatus(id: string, rubroId: string, espacioId: string, status: PedidoStatus, motivo?: string): Promise<PedidoEntity> {
		await this.rubros.findOne(rubroId, espacioId);
		return this.dataSource.transaction(async manager => {
			const pedidos = manager.getRepository(PedidoEntity);
			const productos = manager.getRepository(ProductoEntity);
			const pedido = await pedidos.findOne({ where: { id, rubroId } });
			if (!pedido) throw new NotFoundException('Pedido no encontrado');
			if (!PEDIDO_TRANSITIONS[pedido.status].includes(status)) {
				throw new BadRequestException('Ese cambio de estado no está permitido');
			}
			// Con el envío ya generado, primero hay que anularlo (para recuperar el saldo).
			if (status === 'cancelado' && pedido.etiqueta) {
				throw new BadRequestException('Este pedido tiene un envío generado: anulalo antes de cancelar');
			}

			const descontar = status === 'pagado' && !pedido.stockDescontado;
			const devolver = status === 'cancelado' && pedido.stockDescontado;
			if (descontar || devolver) {
				for (const it of pedido.items) {
					const p = await productos.findOne({ where: { id: it.productoId, rubroId } });
					// Producto borrado o sin control de stock: no hay nada que ajustar.
					if (!p || p.stock == null) continue;
					p.stock = descontar ? Math.max(0, p.stock - it.cantidad) : p.stock + it.cantidad;
					await productos.save(p);
				}
				pedido.stockDescontado = descontar;
			}

			pedido.status = status;
			if (status === 'rechazado' || status === 'cancelado') pedido.motivo = motivo?.trim() || null;
			return pedidos.save(pedido);
		});
	}
}
