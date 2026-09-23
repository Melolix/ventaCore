import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetaConnectionService } from './meta-connection.service';
import { MetaOauthService } from './meta-oauth.service';

/**
 * Callback público del OAuth de Meta. Meta redirige el navegador acá (sin
 * nuestra sesión), por eso NO lleva guard: la seguridad está en el `state`
 * firmado que emitimos al iniciar la conexión. Al terminar, redirige de vuelta
 * al panel del admin con el resultado.
 */
@ApiExcludeController()
@Controller('meta')
export class MetaController {
	constructor(
		private readonly oauth: MetaOauthService,
		private readonly connections: MetaConnectionService,
	) {}

	@Get('callback')
	async callback(
		@Res() res: Response,
		@Query('code') code?: string,
		@Query('state') state?: string,
		@Query('error') error?: string,
	) {
		const base = process.env.META_POST_CONNECT_REDIRECT || 'http://localhost:5173/admin';

		if (error || !code || !state) {
			return res.redirect(this.back(base, { meta: 'error', reason: error || 'cancelado' }));
		}

		try {
			const parsed = this.oauth.verifyState(state);
			const creds = this.connections.getAppCredentials();
			const { token, expiresAt } = await this.oauth.exchangeCode(creds.appId, creds.appSecret, code);
			const me = await this.oauth.getMe(token);
			const targets = await this.oauth.discoverTargets(token);
			const scopes = await this.oauth.getGrantedScopes(token);

			await this.connections.saveFromOAuth(parsed, {
				metaUserId: me.id,
				metaUserName: me.name,
				userAccessToken: token,
				tokenExpiresAt: expiresAt,
				scopes,
				targets,
			});

			// Si destildó permisos en el consentimiento, avisamos cuáles faltan.
			const missing = this.oauth.missingScopes(scopes);
			return res.redirect(
				this.back(base, {
					meta: 'connected',
					rubroId: parsed.rubroId,
					...(missing.length ? { missing: missing.join(',') } : {}),
				}),
			);
		} catch (e) {
			return res.redirect(this.back(base, { meta: 'error', reason: (e as Error).message.slice(0, 120) }));
		}
	}

	/**
	 * Callback de eliminación de datos (Configuración → Básica → "Eliminación de
	 * datos de usuario" en la app de Meta). Meta lo llama cuando un usuario pide
	 * borrar sus datos: borramos sus conexiones (tokens incluidos) y respondemos
	 * con la URL de estado + código de confirmación, como exige Meta.
	 */
	@Post('data-deletion')
	@HttpCode(200)
	async dataDeletion(@Body('signed_request') signedRequest: string) {
		const { appSecret } = this.connections.getAppCredentials();
		const { user_id } = this.oauth.parseSignedRequest(signedRequest, appSecret);
		await this.connections.deleteByMetaUser(user_id);

		const code = randomBytes(8).toString('hex');
		return {
			url: `${this.oauth.publicOrigin}/eliminar-datos?codigo=${code}`,
			confirmation_code: code,
		};
	}

	/**
	 * Callback de desautorización (Facebook Login → Configuración → "URL de
	 * devolución de llamada para cancelar autorización"). El usuario quitó la
	 * app desde Facebook: marcamos sus conexiones como revocadas.
	 */
	@Post('deauthorize')
	@HttpCode(200)
	async deauthorize(@Body('signed_request') signedRequest: string) {
		const { appSecret } = this.connections.getAppCredentials();
		const { user_id } = this.oauth.parseSignedRequest(signedRequest, appSecret);
		await this.connections.revokeByMetaUser(user_id);
		return { ok: true };
	}

	private back(base: string, params: Record<string, string>): string {
		const sep = base.includes('?') ? '&' : '?';
		return `${base}${sep}${new URLSearchParams(params).toString()}`;
	}
}
