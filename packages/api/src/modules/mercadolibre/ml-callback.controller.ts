import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MlConnectionService } from './ml-connection.service';
import { MlOauthService } from './ml-oauth.service';

/**
 * Callback público del OAuth de Mercado Libre. ML redirige el navegador acá (sin
 * nuestra sesión), por eso NO lleva guard: la seguridad está en el `state`
 * firmado que emitimos al iniciar la conexión. Al terminar, redirige de vuelta
 * al panel del admin con el resultado.
 */
@ApiExcludeController()
@Controller('ml')
export class MlCallbackController {
	constructor(
		private readonly oauth: MlOauthService,
		private readonly connections: MlConnectionService,
	) {}

	@Get('callback')
	async callback(
		@Res() res: Response,
		@Query('code') code?: string,
		@Query('state') state?: string,
		@Query('error') error?: string,
	) {
		const base = process.env.ML_POST_CONNECT_REDIRECT || 'http://localhost:5173/admin';

		if (error || !code || !state) {
			return res.redirect(this.back(base, { ml: 'error', reason: error || 'cancelado' }));
		}

		try {
			const parsed = this.oauth.verifyState(state);
			const creds = this.connections.getAppCredentials();
			const tokens = await this.oauth.exchangeCode(creds.appId, creds.appSecret, code);
			const me = await this.oauth.getMe(tokens.accessToken);

			await this.connections.saveFromOAuth(parsed, tokens, me);

			return res.redirect(this.back(base, { ml: 'connected', rubroId: parsed.rubroId }));
		} catch (e) {
			return res.redirect(this.back(base, { ml: 'error', reason: (e as Error).message.slice(0, 120) }));
		}
	}

	private back(base: string, params: Record<string, string>): string {
		const sep = base.includes('?') ? '&' : '?';
		return `${base}${sep}${new URLSearchParams(params).toString()}`;
	}
}
