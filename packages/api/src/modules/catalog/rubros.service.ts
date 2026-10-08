import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RubroStatus } from '@base-template/shared';
import { RubroEntity } from './entities/rubro.entity';
import { ProductoEntity } from './entities/producto.entity';
import { EnviaService } from './envia.service';
import { CreateRubroDto } from './dto/create-rubro.dto';
import { UpdateRubroDto } from './dto/update-rubro.dto';

/** Limpia la lista: sin vacíos ni repetidos (sin distinguir mayúsculas), respetando el orden. */
function normalizeCategorias(list: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of list) {
		const name = raw.trim();
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
}

@Injectable()
export class RubrosService {
	constructor(
		@InjectRepository(RubroEntity)
		private readonly repo: Repository<RubroEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly envia: EnviaService,
	) {}

	async findByEspacio(espacioId: string): Promise<RubroEntity[]> {
		const rubros = await this.repo.find({ where: { espacioId }, order: { createdAt: 'DESC' } });
		return rubros.map(r => Object.assign(r, { etiquetasActivas: this.envia.etiquetas }));
	}

	/** Busca un rubro validando que pertenezca al espacio dado. */
	async findOne(id: string, espacioId: string): Promise<RubroEntity> {
		const rubro = await this.repo.findOne({ where: { id, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return Object.assign(rubro, { etiquetasActivas: this.envia.etiquetas });
	}

	create(espacioId: string, dto: CreateRubroDto): Promise<RubroEntity> {
		const entity = this.repo.create({ ...dto, espacioId });
		return this.repo.save(entity);
	}

	async update(id: string, espacioId: string, dto: UpdateRubroDto): Promise<RubroEntity> {
		const rubro = await this.findOne(id, espacioId);
		Object.assign(rubro, dto);
		if (dto.categorias) rubro.categorias = normalizeCategorias(dto.categorias);
		// Cuenta propia de envia: el token no viaja en las respuestas; queda la marca.
		if (dto.enviaToken !== undefined) {
			rubro.enviaToken = dto.enviaToken?.trim() || null;
			rubro.enviaPropia = !!rubro.enviaToken;
		}
		await this.repo.save(rubro);
		// Releemos: el DTO trae como `undefined` los campos que no vinieron y pisaba
		// esas propiedades en la respuesta (el panel "perdía" categorías/plataformas
		// hasta recargar). En la base no se tocaban; era solo la respuesta.
		return this.findOne(id, espacioId);
	}

	/**
	 * Renombra una categoría (o la borra, con `to` vacío) en la lista del rubro Y
	 * en sus productos, para que no queden apuntando al nombre viejo. Si `to` ya
	 * existe, las dos se fusionan. Los productos de una categoría borrada quedan
	 * sin categoría ("Otros" en la tienda).
	 */
	async renameCategoria(id: string, espacioId: string, from: string, to?: string): Promise<RubroEntity> {
		const rubro = await this.findOne(id, espacioId);
		const target = (to ?? '').trim();
		const next = (rubro.categorias ?? []).map(c => (c === from ? target : c));
		rubro.categorias = normalizeCategorias(next);
		await this.productos.update({ rubroId: id, seccion: from }, { seccion: target || null });
		return this.repo.save(rubro);
	}

	/**
	 * Suma a la lista del rubro las categorías nuevas que aparecen al guardar
	 * productos (el vendedor las escribe en la carga masiva): así entran al menú
	 * de la tienda sin un paso aparte. Van al final; el orden se ajusta en Rubros.
	 */
	async addCategorias(id: string, names: Iterable<string>): Promise<void> {
		const rubro = await this.repo.findOne({ where: { id } });
		if (!rubro) return;
		const next = normalizeCategorias([...(rubro.categorias ?? []), ...names]);
		if (next.length === (rubro.categorias ?? []).length) return;
		await this.repo.update({ id }, { categorias: next });
	}

	async remove(id: string, espacioId: string): Promise<void> {
		const rubro = await this.findOne(id, espacioId);
		await this.repo.remove(rubro);
	}

	// ── Uso interno (otros servicios): el rubro tal cual, con datos privados ──

	/** Un rubro activo con TODOS sus datos (uso interno; no devolver al público). */
	async findActive(id: string): Promise<RubroEntity> {
		const rubro = await this.repo.findOne({ where: { id, status: RubroStatus.ACTIVE } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	/** Un rubro por id, sin filtros (uso interno). */
	findRaw(id: string): Promise<RubroEntity | null> {
		return this.repo.findOne({ where: { id } });
	}

	// ── Público: solo rubros activos de un espacio ──

	/** Rubros activos de un espacio, con el conteo de productos. */
	async findPublicByEspacio(espacioId: string): Promise<RubroEntity[]> {
		const rubros = await this.repo
			.createQueryBuilder('rubro')
			.loadRelationCountAndMap('rubro.productCount', 'rubro.productos')
			.where('rubro.espacioId = :espacioId', { espacioId })
			.andWhere('rubro.status = :status', { status: RubroStatus.ACTIVE })
			.orderBy('rubro.createdAt', 'DESC')
			.getMany();
		return rubros.map(r => this.publico(r));
	}

	/**
	 * Versión pública del rubro: sin los datos para transferir ni la dirección de
	 * despacho (el cliente ve el pago en su pedido, cuando el vendedor confirma), y
	 * con la marca de si se pueden cotizar envíos.
	 */
	private publico(rubro: RubroEntity): RubroEntity {
		const enviosActivos = this.envia.activo(rubro);
		return Object.assign(rubro, { pagoAlias: null, pagoCbu: null, pagoTitular: null, despacho: null, enviosActivos });
	}

	/** Un rubro activo (404 si no existe o está en borrador). */
	async findPublicOne(id: string): Promise<RubroEntity> {
		return this.publico(await this.findActive(id));
	}
}
