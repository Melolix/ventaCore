import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EspacioType, Role, type Espacio } from '@base-template/shared';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { EspacioEntity } from './entities/espacio.entity';
import { CreateEspacioDto } from './dto/create-espacio.dto';
import { UpdateEspacioDto } from './dto/update-espacio.dto';
import { UpdateAboutDto } from './dto/update-about.dto';

/** Convierte un nombre en un slug URL-safe (sin acentos ni símbolos). */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

@Injectable()
export class EspaciosService {
	constructor(
		@InjectRepository(EspacioEntity)
		private readonly repo: Repository<EspacioEntity>,
		@InjectRepository(UserEntity)
		private readonly users: Repository<UserEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly usersService: UsersService,
	) {}

	private async uniqueSlug(nombre: string): Promise<string> {
		const base = slugify(nombre) || 'espacio';
		let slug = base;
		let n = 1;
		while ((await this.repo.count({ where: { slug } })) > 0) {
			slug = `${base}-${++n}`;
		}
		return slug;
	}

	private async withMeta(espacio: EspacioEntity): Promise<Espacio> {
		const admin = await this.users.findOne({ where: { espacioId: espacio.id, role: Role.ADMIN } });
		const rubroCount = await this.rubros.count({ where: { espacioId: espacio.id } });
		return {
			id: espacio.id,
			nombre: espacio.nombre,
			type: espacio.type,
			slug: espacio.slug,
			domain: espacio.domain,
			descripcion: espacio.descripcion,
			logoUrl: espacio.logoUrl,
			active: espacio.active,
			whatsapp: espacio.whatsapp,
			instagramUrl: espacio.instagramUrl,
			aboutHeadline: espacio.aboutHeadline,
			aboutText: espacio.aboutText,
			aboutImageUrl: espacio.aboutImageUrl,
			createdAt: espacio.createdAt.toISOString(),
			updatedAt: espacio.updatedAt.toISOString(),
			adminEmail: admin?.email ?? null,
			rubroCount,
		};
	}

	// ── Superadmin ──

	async findAllWithMeta(): Promise<Espacio[]> {
		const espacios = await this.repo.find({ order: { createdAt: 'DESC' } });
		return Promise.all(espacios.map(e => this.withMeta(e)));
	}

	async findOne(id: string): Promise<EspacioEntity> {
		const espacio = await this.repo.findOne({ where: { id } });
		if (!espacio) throw new NotFoundException('Espacio no encontrado');
		return espacio;
	}

	/** Crea el espacio (con slug único) y su admin (CM). */
	async create(dto: CreateEspacioDto): Promise<Espacio> {
		const slug = await this.uniqueSlug(dto.nombre);
		const espacio = await this.repo.save(
			this.repo.create({
				nombre: dto.nombre,
				type: dto.type ?? EspacioType.CATALOG,
				slug,
				domain: dto.domain?.trim() || null,
				descripcion: dto.descripcion ?? null,
				logoUrl: dto.logoUrl ?? null,
				active: true,
			}),
		);

		try {
			await this.usersService.create({
				email: dto.adminEmail,
				password: dto.adminPassword,
				role: Role.ADMIN,
				displayName: dto.nombre,
				espacioId: espacio.id,
			});
		} catch (err) {
			// Si falla el alta del admin, revertimos el espacio para no dejarlo huérfano.
			await this.repo.remove(espacio);
			throw err;
		}

		return this.withMeta(espacio);
	}

	async update(id: string, dto: UpdateEspacioDto): Promise<Espacio> {
		const espacio = await this.findOne(id);
		Object.assign(espacio, dto);
		await this.repo.save(espacio);
		return this.withMeta(espacio);
	}

	/** Borra el espacio, su admin (Firebase + DB) y sus rubros (productos en cascada). */
	async remove(id: string): Promise<void> {
		const espacio = await this.findOne(id);
		await this.rubros.delete({ espacioId: id });
		const admins = await this.users.find({ where: { espacioId: id } });
		for (const admin of admins) {
			await this.usersService.remove(admin.id);
		}
		await this.repo.remove(espacio);
	}

	// ── Admin del espacio: su propia página "Sobre Nosotros" ──

	/** El espacio del admin logueado. */
	findById(id: string): Promise<EspacioEntity> {
		return this.findOne(id);
	}

	/** Actualiza solo los campos de la página "Sobre Nosotros". */
	async updateAbout(id: string, dto: UpdateAboutDto): Promise<EspacioEntity> {
		const espacio = await this.findOne(id);
		if (dto.whatsapp !== undefined) espacio.whatsapp = dto.whatsapp || null;
		if (dto.instagramUrl !== undefined) espacio.instagramUrl = dto.instagramUrl || null;
		if (dto.aboutHeadline !== undefined) espacio.aboutHeadline = dto.aboutHeadline || null;
		if (dto.aboutText !== undefined) espacio.aboutText = dto.aboutText || null;
		if (dto.aboutImageUrl !== undefined) espacio.aboutImageUrl = dto.aboutImageUrl || null;
		return this.repo.save(espacio);
	}

	// ── Público: resolución por dominio ──

	/**
	 * Resuelve el negocio según el hostname del navegador:
	 *  1) por dominio propio (domain === host)
	 *  2) por subdominio (primer label del host === slug), ej campo-ruta.localhost
	 *
	 * Buscamos SIN filtrar por `active` para poder distinguir un negocio
	 * suspendido (403) de uno inexistente (404): así la vitrina puede mostrar
	 * el mensaje correcto en cada caso.
	 */
	async resolveByHost(host: string): Promise<EspacioEntity> {
		const clean = (host || '').toLowerCase().split(':')[0].trim();

		let espacio = await this.repo.findOne({ where: { domain: clean } });
		if (!espacio) {
			const sub = clean.split('.')[0];
			if (sub) espacio = await this.repo.findOne({ where: { slug: sub } });
		}

		if (!espacio) throw new NotFoundException('No hay un negocio en este dominio');
		if (!espacio.active) {
			throw new ForbiddenException({ code: 'ESPACIO_SUSPENDED', message: 'El negocio está suspendido' });
		}
		return espacio;
	}
}
