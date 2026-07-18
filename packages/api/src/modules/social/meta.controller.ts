import { Controller, Get, Query, Res } from '@nestjs/common';
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
			const creds = await this.connections.getAppCredentials(parsed.rubroId, parsed.espacioId);
			const { token, expiresAt } = await this.oauth.exchangeCode(creds.appId, creds.appSecret, code);
			const me = await this.oauth.getMe(token);
			const targets = await this.oauth.discoverTargets(token);

			await this.connections.saveFromOAuth(parsed, {
				metaUserId: me.id,
				metaUserName: me.name,
				userAccessToken: token,
				tokenExpiresAt: expiresAt,
				scopes: [],
				targets,
			});

			return res.redirect(this.back(base, { meta: 'connected', rubroId: parsed.rubroId }));
		} catch (e) {
			return res.redirect(this.back(base, { meta: 'error', reason: (e as Error).message.slice(0, 120) }));
		}
	}

	private back(base: string, params: Record<string, string>): string {
		const sep = base.includes('?') ? '&' : '?';
		return `${base}${sep}${new URLSearchParams(params).toString()}`;
	}
}
