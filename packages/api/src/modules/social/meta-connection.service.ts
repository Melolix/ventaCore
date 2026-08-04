import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaConnectionStatus, type MetaConnection, type MetaRubroState, type MetaTarget } from '@base-template/shared';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { MetaConnectionEntity } from './entities/meta-connection.entity';
import { MetaTargetEntity } from './entities/meta-target.entity';
import type { MetaOAuthResult, MetaOAuthState } from './meta-oauth.service';

/** Destino resuelto para publicar (con el token de Página ya descifrado). */
export interface ResolvedTarget {
	pageId: string;
	pageName: string;
	pageAccessToken: string;
	igBusinessAccountId: string | null;
	igUsername: string | null;
}

@Injectable()
export class MetaConnectionService {
	constructor(
		@InjectRepository(MetaConnectionEntity)
		private readonly connections: Repository<MetaConnectionEntity>,
		@InjectRepository(MetaTargetEntity)
		private readonly targets: Repository<MetaTargetEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly crypto: TokenCryptoService,
	) {}

	// ── Lectura ──

	/** Conexión (vista pública, sin tokens) de un rubro, o null si no conectó Meta. */
	async findByRubro(rubroId: string): Promise<MetaConnection | null> {
		const entity = await this.connections.findOne({ where: { rubroId }, relations: { targets: true } });
		return entity ? MetaConnectionService.toPublic(entity) : null;
	}

	/** Estado completo de Meta del rubro (app de plataforma lista + conexión). Valida el espacio. */
	async stateForRubro(rubroId: string, espacioId: string): Promise<MetaRubroState> {
		await this.assertRubro(rubroId, espacioId);
		const connection = await this.findByRubro(rubroId);
		const appId = process.env.META_APP_ID?.trim() || null;
		// La app (App ID + Secret) es de plataforma: alcanza con que estén en el
		// entorno para que cualquier negocio pueda conectar su cuenta.
		const appConfigured = !!(appId && process.env.META_APP_SECRET?.trim());
		return {
			appConfigured,
			appId: appConfigured ? appId : null,
			connection,
		};
	}

	// ── Credenciales de la app de PLATAFORMA (una sola para todos los negocios) ──

	/**
	 * Credenciales de la app de Meta de la plataforma (App ID + Secret), las mismas
	 * para todos los negocios. Se cargan una vez por entorno (META_APP_ID /
	 * META_APP_SECRET); cada negocio solo autoriza su Página/IG vía OAuth. Lanza si
	 * la plataforma no las configuró.
	 */
	getAppCredentials(): { appId: string; appSecret: string } {
		const appId = process.env.META_APP_ID?.trim();
		const appSecret = process.env.META_APP_SECRET?.trim();
		if (!appId || !appSecret) {
			throw new BadRequestException('Meta no está configurado en la plataforma (falta META_APP_ID / META_APP_SECRET)');
		}
		return { appId, appSecret };
	}

	/** Todas las conexiones (vista pública) de los rubros de un espacio. */
	async listByEspacio(espacioId: string): Promise<MetaConnection[]> {
		const entities = await this.connections.find({ where: { espacioId }, relations: { targets: true } });
		return entities.map(MetaConnectionService.toPublic);
	}

	// ── Escritura ──

	/**
	 * Guarda (o reemplaza) la conexión de un rubro tras el OAuth. Cifra los
	 * tokens, regenera los destinos y, si hay uno solo, lo deja preseleccionado.
	 */
	async saveFromOAuth(state: MetaOAuthState, result: MetaOAuthResult): Promise<void> {
		const rubro = await this.assertRubro(state.rubroId, state.espacioId);

		let connection = await this.connections.findOne({ where: { rubroId: state.rubroId } });
		if (connection) {
			await this.targets.delete({ connectionId: connection.id });
		} else {
			connection = this.connections.create({ rubroId: state.rubroId, espacioId: state.espacioId });
		}

		connection.metaUserId = result.metaUserId;
		connection.metaUserName = result.metaUserName;
		connection.userAccessToken = this.crypto.encrypt(result.userAccessToken);
		connection.tokenExpiresAt = result.tokenExpiresAt;
		connection.scopes = result.scopes;
		connection.status = MetaConnectionStatus.CONNECTED;
		connection = await this.connections.save(connection);

		const saved = await this.targets.save(
			result.targets.map(t =>
				this.targets.create({
					connectionId: connection!.id,
					pageId: t.pageId,
					pageName: t.pageName,
					pageAccessToken: this.crypto.encrypt(t.pageAccessToken),
					igBusinessAccountId: t.igBusinessAccountId,
					igUsername: t.igUsername,
					enabled: true,
				}),
			),
		);

		// Preselecciona el destino si hay uno solo; si no, obliga a re-elegir.
		rubro.metaTargetId = saved.length === 1 ? saved[0].id : null;
		await this.rubros.save(rubro);
	}

	/** Desconecta Meta de un rubro: borra la conexión (cascade) y limpia el destino. */
	async disconnect(rubroId: string, espacioId: string): Promise<void> {
		const rubro = await this.assertRubro(rubroId, espacioId);
		await this.connections.delete({ rubroId });
		if (rubro.metaTargetId) {
			rubro.metaTargetId = null;
			await this.rubros.save(rubro);
		}
	}

	/** Elige a qué Página/IG publica el rubro. Valida que el target sea de su conexión. */
	async setTarget(rubroId: string, espacioId: string, metaTargetId: string): Promise<MetaConnection> {
		const rubro = await this.assertRubro(rubroId, espacioId);
		const connection = await this.connections.findOne({ where: { rubroId } });
		if (!connection) throw new BadRequestException('El rubro no tiene una cuenta de Meta conectada');

		const target = await this.targets.findOne({ where: { id: metaTargetId, connectionId: connection.id } });
		if (!target) throw new BadRequestException('El destino elegido no pertenece a este rubro');

		rubro.metaTargetId = target.id;
		await this.rubros.save(rubro);
		return (await this.findByRubro(rubroId))!;
	}

	// ── Resolución para publicar ──

	/** Devuelve el destino elegido por el rubro, con el token de Página descifrado. */
	async resolveTargetForRubro(rubroId: string, espacioId: string): Promise<ResolvedTarget> {
		const rubro = await this.assertRubro(rubroId, espacioId);
		if (!rubro.metaTargetId) {
			throw new BadRequestException('El rubro no tiene una cuenta de Meta lista para publicar');
		}
		const target = await this.targets.findOne({ where: { id: rubro.metaTargetId } });
		if (!target) throw new BadRequestException('El destino de Meta del rubro ya no existe; reconectá la cuenta');

		return {
			pageId: target.pageId,
			pageName: target.pageName,
			pageAccessToken: this.crypto.decrypt(target.pageAccessToken),
			igBusinessAccountId: target.igBusinessAccountId,
			igUsername: target.igUsername,
		};
	}

	// ── Helpers ──

	private async assertRubro(rubroId: string, espacioId: string): Promise<RubroEntity> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	static toPublic(entity: MetaConnectionEntity): MetaConnection {
		return {
			id: entity.id,
			rubroId: entity.rubroId,
			espacioId: entity.espacioId,
			status: entity.status ?? MetaConnectionStatus.CONNECTED,
			metaUserName: entity.metaUserName,
			scopes: entity.scopes ?? [],
			tokenExpiresAt: entity.tokenExpiresAt ? entity.tokenExpiresAt.toISOString() : null,
			connectedAt: entity.updatedAt.toISOString(),
			targets: (entity.targets ?? []).map(MetaConnectionService.toPublicTarget),
		};
	}

	private static toPublicTarget(target: MetaTargetEntity): MetaTarget {
		return {
			id: target.id,
			pageId: target.pageId,
			pageName: target.pageName,
			igBusinessAccountId: target.igBusinessAccountId,
			igUsername: target.igUsername,
			enabled: target.enabled,
		};
	}
}
