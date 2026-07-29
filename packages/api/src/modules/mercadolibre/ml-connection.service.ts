import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MlConnectionStatus, type MlConnection, type MlRubroState } from '@base-template/shared';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { MlConnectionEntity } from './entities/ml-connection.entity';
import { MlAppConfigEntity } from './entities/ml-app-config.entity';
import { MlOauthService, type MlOAuthState, type MlTokens } from './ml-oauth.service';

/** Margen para refrescar el access token antes de que venza (evita 401 al borde). */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

@Injectable()
export class MlConnectionService {
	constructor(
		@InjectRepository(MlConnectionEntity)
		private readonly connections: Repository<MlConnectionEntity>,
		@InjectRepository(MlAppConfigEntity)
		private readonly appConfigs: Repository<MlAppConfigEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly crypto: TokenCryptoService,
		private readonly oauth: MlOauthService,
	) {}

	// ── Lectura ──

	/** Conexión (vista pública, sin tokens) de un rubro, o null si no conectó ML. */
	async findByRubro(rubroId: string): Promise<MlConnection | null> {
		const entity = await this.connections.findOne({ where: { rubroId } });
		return entity ? MlConnectionService.toPublic(entity) : null;
	}

	/** Estado completo de ML del rubro (app configurada + conexión). Valida el espacio. */
	async stateForRubro(rubroId: string, espacioId: string): Promise<MlRubroState> {
		await this.assertRubro(rubroId, espacioId);
		const appConfig = await this.appConfigs.findOne({ where: { rubroId } });
		const connection = await this.findByRubro(rubroId);
		return {
			appConfigured: !!appConfig,
			appId: appConfig?.appId ?? null,
			connection,
		};
	}

	// ── Credenciales de la app propia del rubro (modelo BYO) ──

	/** Guarda (upsert) el App ID + Client Secret de la app de ML del rubro. */
	async saveAppConfig(rubroId: string, espacioId: string, appId: string, appSecret: string): Promise<MlRubroState> {
		await this.assertRubro(rubroId, espacioId);
		let config = await this.appConfigs.findOne({ where: { rubroId } });
		if (!config) {
			config = this.appConfigs.create({ rubroId, espacioId });
		}
		config.appId = appId.trim();
		config.appSecret = this.crypto.encrypt(appSecret.trim());
		await this.appConfigs.save(config);
		return this.stateForRubro(rubroId, espacioId);
	}

	/** Devuelve las credenciales (secret descifrado) de la app del rubro. */
	async getAppCredentials(rubroId: string, espacioId: string): Promise<{ appId: string; appSecret: string }> {
		await this.assertRubro(rubroId, espacioId);
		const config = await this.appConfigs.findOne({ where: { rubroId } });
		if (!config) {
			throw new BadRequestException('Primero cargá el App ID y Client Secret de la app de Mercado Libre del rubro');
		}
		return { appId: config.appId, appSecret: this.crypto.decrypt(config.appSecret) };
	}

	// ── Escritura ──

	/** Guarda (o reemplaza) la conexión de un rubro tras el OAuth. Cifra los tokens. */
	async saveFromOAuth(
		state: MlOAuthState,
		tokens: MlTokens,
		me: { nickname: string; siteId: string | null },
	): Promise<void> {
		await this.assertRubro(state.rubroId, state.espacioId);

		let connection = await this.connections.findOne({ where: { rubroId: state.rubroId } });
		if (!connection) {
			connection = this.connections.create({ rubroId: state.rubroId, espacioId: state.espacioId });
		}

		this.applyTokens(connection, tokens);
		connection.mlUserId = tokens.userId;
		connection.mlNickname = me.nickname;
		connection.siteId = me.siteId;
		connection.status = MlConnectionStatus.CONNECTED;
		await this.connections.save(connection);
	}

	/** Desconecta ML de un rubro: borra la conexión. */
	async disconnect(rubroId: string, espacioId: string): Promise<void> {
		await this.assertRubro(rubroId, espacioId);
		await this.connections.delete({ rubroId });
	}

	// ── Resolución para publicar (Fase C) ──

	/**
	 * Devuelve un access token vigente del rubro, refrescándolo contra ML si está
	 * por vencer. Persiste el nuevo par de tokens (el refresh token es de un solo
	 * uso). Lanza si el rubro no tiene ML conectado o el refresh falla.
	 */
	async getValidAccessToken(
		rubroId: string,
		espacioId: string,
	): Promise<{ accessToken: string; mlUserId: string; siteId: string }> {
		await this.assertRubro(rubroId, espacioId);
		const connection = await this.connections.findOne({ where: { rubroId } });
		if (!connection) throw new BadRequestException('El rubro no tiene una cuenta de Mercado Libre conectada');

		const expiring = !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
		if (expiring) {
			const creds = await this.getAppCredentials(rubroId, espacioId);
			try {
				const tokens = await this.oauth.refresh(creds.appId, creds.appSecret, this.crypto.decrypt(connection.refreshToken));
				this.applyTokens(connection, tokens);
				connection.status = MlConnectionStatus.CONNECTED;
				await this.connections.save(connection);
			} catch (e) {
				connection.status = MlConnectionStatus.EXPIRED;
				await this.connections.save(connection);
				throw new BadRequestException(
					`No se pudo renovar el acceso a Mercado Libre; reconectá la cuenta. (${(e as Error).message})`,
				);
			}
		}

		return {
			accessToken: this.crypto.decrypt(connection.accessToken),
			mlUserId: connection.mlUserId ?? '',
			siteId: connection.siteId ?? 'MLA',
		};
	}

	// ── Helpers ──

	/** Cifra y vuelca los tokens en la entidad (sin guardar). */
	private applyTokens(connection: MlConnectionEntity, tokens: MlTokens): void {
		connection.accessToken = this.crypto.encrypt(tokens.accessToken);
		connection.refreshToken = this.crypto.encrypt(tokens.refreshToken);
		connection.tokenExpiresAt = tokens.expiresAt;
		if (tokens.scopes.length) connection.scopes = tokens.scopes;
	}

	private async assertRubro(rubroId: string, espacioId: string): Promise<RubroEntity> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		return rubro;
	}

	static toPublic(entity: MlConnectionEntity): MlConnection {
		return {
			id: entity.id,
			rubroId: entity.rubroId,
			espacioId: entity.espacioId,
			status: entity.status ?? MlConnectionStatus.CONNECTED,
			mlUserId: entity.mlUserId,
			mlNickname: entity.mlNickname,
			siteId: entity.siteId,
			scopes: entity.scopes ?? [],
			tokenExpiresAt: entity.tokenExpiresAt ? entity.tokenExpiresAt.toISOString() : null,
			connectedAt: entity.updatedAt.toISOString(),
		};
	}
}
