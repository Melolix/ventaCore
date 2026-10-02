import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PEDIDO_TRANSITIONS, type PedidoItem, type PedidoPublic, type PedidoStatus } from '@base-template/shared';
import { EspaciosService } from '../spaces/espacios.service';
import { PedidoEntity } from './entities/pedido.entity';
import { ProductoEntity } from './entities/producto.entity';
import { RubroEntity } from './entities/rubro.entity';
import { RubrosService } from './rubros.service';
import { CreatePedidoDto } from './dto/pedido.dto';

/** Estados en los que el cliente ya puede ver los datos para transferir. */
const PAGO_VISIBLE: PedidoStatus[] = ['confirmado', 'pagado', 'entregado'];

@Injectable()
export class PedidosService {
	constructor(
		@InjectRepository(PedidoEntity)
		private readonly repo: Repository<PedidoEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly rubros: RubrosService,
		private readonly espacios: EspaciosService,
		private readonly dataSource: DataSource,
	) {}

	// ── Público (vitrina) ──

	/**
	 * Crea el pedido desde la vitrina. El cliente solo manda ids y cantidades: el
	 * nombre y el precio los pone el servidor (no se puede "pedir más barato"), y
	 * se valida que cada producto sea del rubro, tenga precio y alcance el stock.
	 */
	async createPublic(rubroId: string, dto: CreatePedidoDto): Promise<PedidoPublic> {
		const rubro = await this.rubros.findActive(rubroId);
		if (dto.entrega === 'envio' && !dto.direccion?.trim()) {
			throw new BadRequestException('Falta la dirección para el envío');
		}

		// Unificamos líneas repetidas del mismo producto.
		const cantidades = new Map<string, number>();
		for (const it of dto.items) cantidades.set(it.productoId, (cantidades.get(it.productoId) ?? 0) + it.cantidad);

		const encontrados = await this.productos.find({ where: { id: In([...cantidades.keys()]), rubroId } });
		const porId = new Map(encontrados.map(p => [p.id, p]));

		const items: PedidoItem[] = [];
		for (const [productoId, cantidad] of cantidades) {
			const p = porId.get(productoId);
			if (!p) throw new BadRequestException('Uno de los productos ya no está disponible');
			if (p.precio == null) throw new BadRequestException(`"${p.nombre}" no tiene precio: consultalo con el vendedor`);
			if (p.stock != null && cantidad > p.stock) {
				throw new BadRequestException(p.stock === 0 ? `"${p.nombre}" se quedó sin stock` : `De "${p.nombre}" quedan ${p.stock}`);
			}
			items.push({ productoId, nombre: p.nombre, precio: p.precio, cantidad, imageUrl: p.imageUrl });
		}
		const total = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);

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
						direccion: dto.entrega === 'envio' ? (dto.direccion?.trim() ?? null) : null,
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
		};
	}

	// ── Panel (vendedor) ──

	async findByRubro(rubroId: string, espacioId: string): Promise<PedidoEntity[]> {
		await this.rubros.findOne(rubroId, espacioId);
		return this.repo.find({ where: { rubroId }, order: { createdAt: 'DESC' }, take: 300 });
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
