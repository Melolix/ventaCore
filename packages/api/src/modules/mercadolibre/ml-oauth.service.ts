import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Permisos que pedimos en el consentimiento de Mercado Libre.
 *  - `offline_access` es imprescindible para recibir un refresh token.
 *  - `read` / `write` para leer datos del vendedor y crear/editar publicaciones.
 */
const SCOPES = ['offline_access', 'read', 'write'];

/** Payload firmado que viaja en el parámetro `state` del OAuth. */
export interface MlOAuthState {
	/** Rubro que está conectando su cuenta. */
	rubroId: string;
	/** Espacio (tenant) del rubro; se valida al volver. */
	espacioId: string;
}

/** Tokens devueltos por ML al intercambiar el code o refrescar. */
export interface MlTokens {
	accessToken: string;
	refreshToken: string;
	/** Vencimiento del access token (ML: 6 h). */
	expiresAt: Date;
	/** ID del usuario/vendedor de ML. */
	userId: string;
	scopes: string[];
}

/**
 * Cliente del OAuth de Mercado Libre. No toca la base: arma la URL de
 * consentimiento, intercambia el `code` por tokens y refresca tokens vencidos.
 */
@Injectable()
export class MlOauthService {
	private get redirectUri(): string {
		return this.required('ML_REDIRECT_URI');
	}
	/** Host del consentimiento; por sitio (ej. MLA → .com.ar). Configurable. */
	private get authHost(): string {
		return process.env.ML_AUTH_HOST || 'https://auth.mercadolibre.com.ar';
	}
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}
	/** Clave de plataforma para firmar el `state` (compartida con Meta). */
	private get stateSecret(): string {
		return this.required('META_TOKEN_ENC_KEY');
	}

	private required(key: string): string {
		const value = process.env[key];
		if (!value) {
			throw new InternalServerErrorException(`Falta ${key}: la integración con Mercado Libre no está configurada.`);
		}
		return value;
	}

	// ── State firmado (HMAC) para atar el callback al rubro sin sesión ──

	signState(data: MlOAuthState): string {
		const payload = Buffer.from(JSON.stringify({ ...data, ts: Date.now() })).toString('base64url');
		const sig = createHmac('sha256', this.stateSecret).update(payload).digest('base64url');
		return `${payload}.${sig}`;
	}

	/** Verifica firma y antigüedad (<10 min). Lanza si es inválido. */
	verifyState(state: string): MlOAuthState {
		const [payload, sig] = (state || '').split('.');
		if (!payload || !sig) throw new BadRequestException('State inválido');

		const expected = createHmac('sha256', this.stateSecret).update(payload).digest('base64url');
		const a = Buffer.from(sig);
		const b = Buffer.from(expected);
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new BadRequestException('State con firma inválida');
		}

		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		if (typeof decoded.ts !== 'number' || Date.now() - decoded.ts > 10 * 60 * 1000) {
			throw new BadRequestException('State expirado');
		}
		return { rubroId: decoded.rubroId, espacioId: decoded.espacioId };
	}

	// ── URL de consentimiento (contra la app propia del rubro) ──

	buildAuthUrl(appId: string, state: string): string {
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: appId,
			redirect_uri: this.redirectUri,
			state,
			scope: SCOPES.join(' '),
		});
		return `${this.authHost}/authorization?${params.toString()}`;
	}

	// ── Intercambio / refresh de tokens ──

	/** code → access token (6 h) + refresh token + id del vendedor. */
	exchangeCode(appId: string, appSecret: string, code: string): Promise<MlTokens> {
		return this.tokenRequest({
			grant_type: 'authorization_code',
			client_id: appId,
			client_secret: appSecret,
			code,
			redirect_uri: this.redirectUri,
		});
	}

	/** refresh token → nuevos access + refresh token (el anterior queda inválido). */
	refresh(appId: string, appSecret: string, refreshToken: string): Promise<MlTokens> {
		return this.tokenRequest({
			grant_type: 'refresh_token',
			client_id: appId,
			client_secret: appSecret,
			refresh_token: refreshToken,
		});
	}

	async getMe(accessToken: string): Promise<{ id: string; nickname: string; siteId: string | null }> {
		const me = await this.apiGet<{ id: number; nickname: string; site_id?: string }>('/users/me', accessToken);
		return { id: String(me.id), nickname: me.nickname, siteId: me.site_id ?? null };
	}

	// ── Helpers HTTP ──

	private async tokenRequest(body: Record<string, string>): Promise<MlTokens> {
		const res = await fetch(`${this.apiHost}/oauth/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
			body: new URLSearchParams(body).toString(),
		});
		const data = (await res.json().catch(() => ({}))) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
			user_id?: number;
			scope?: string;
			message?: string;
			error?: string;
		};
		if (!res.ok || !data.access_token || !data.refresh_token) {
			throw new BadRequestException(`Mercado Libre: ${data.message || data.error || res.statusText}`);
		}
		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: new Date(Date.now() + (data.expires_in ?? 21600) * 1000),
			userId: String(data.user_id ?? ''),
			scopes: (data.scope ?? '').split(' ').filter(Boolean),
		};
	}

	private async apiGet<T>(path: string, accessToken: string): Promise<T> {
		const res = await fetch(`${this.apiHost}${path}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		if (!res.ok) {
			throw new BadRequestException(`Mercado Libre: ${body?.message || res.statusText}`);
		}
		return body as T;
	}
}
