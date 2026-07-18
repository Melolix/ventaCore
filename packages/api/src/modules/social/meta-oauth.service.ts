import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Permisos que pedimos en el consentimiento.
 *
 * `pages_manage_posts` (publicar en el feed de la Página de FB) está fuera por
 * ahora: hay apps donde todavía no está habilitado y da "Invalid Scopes".
 * Con los de acá alcanza para conectar, descubrir Páginas/IG y publicar en
 * Instagram. Para publicar en Facebook-Página, habilitar `pages_manage_posts`
 * en el caso de uso de Facebook Login y volver a agregarlo a esta lista.
 */
const SCOPES = [
	'pages_show_list',
	'pages_read_engagement',
	'instagram_basic',
	'instagram_content_publish',
];

/** Payload firmado que viaja en el parámetro `state` del OAuth. */
export interface MetaOAuthState {
	/** Rubro que está conectando su cuenta. */
	rubroId: string;
	/** Espacio (tenant) del rubro; se valida al volver. */
	espacioId: string;
}

/** Una Página de FB descubierta (+ su IG Business vinculado, si tiene). */
export interface DiscoveredTarget {
	pageId: string;
	pageName: string;
	pageAccessToken: string;
	igBusinessAccountId: string | null;
	igUsername: string | null;
}

/** Datos que devuelve el flujo OAuth, listos para persistir. */
export interface MetaOAuthResult {
	metaUserId: string;
	metaUserName: string;
	userAccessToken: string;
	tokenExpiresAt: Date | null;
	scopes: string[];
	targets: DiscoveredTarget[];
}

/**
 * Cliente del OAuth y la Graph API de Meta. No toca la base: arma la URL de
 * consentimiento, intercambia el `code` por tokens y descubre Páginas + IG.
 */
@Injectable()
export class MetaOauthService {
	private get redirectUri(): string {
		return this.required('META_REDIRECT_URI');
	}
	private get version(): string {
		return process.env.META_GRAPH_VERSION || 'v21.0';
	}
	private get graphBase(): string {
		return `https://graph.facebook.com/${this.version}`;
	}
	/** Clave de plataforma para firmar el `state` (NO es el secret de ninguna app). */
	private get stateSecret(): string {
		return this.required('META_TOKEN_ENC_KEY');
	}

	private required(key: string): string {
		const value = process.env[key];
		if (!value) {
			throw new InternalServerErrorException(`Falta ${key}: la integración con Meta no está configurada.`);
		}
		return value;
	}

	// ── State firmado (HMAC) para atar el callback al rubro sin sesión ──

	signState(data: MetaOAuthState): string {
		const payload = Buffer.from(JSON.stringify({ ...data, ts: Date.now() })).toString('base64url');
		const sig = createHmac('sha256', this.stateSecret).update(payload).digest('base64url');
		return `${payload}.${sig}`;
	}

	/** Verifica firma y antigüedad (<10 min). Lanza si es inválido. */
	verifyState(state: string): MetaOAuthState {
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
			client_id: appId,
			redirect_uri: this.redirectUri,
			state,
			scope: SCOPES.join(','),
			response_type: 'code',
		});
		return `https://www.facebook.com/${this.version}/dialog/oauth?${params.toString()}`;
	}

	// ── Intercambio de tokens + descubrimiento ──

	/** code → token de usuario long-lived (~60 días) + su vencimiento. */
	async exchangeCode(appId: string, appSecret: string, code: string): Promise<{ token: string; expiresAt: Date | null }> {
		const short = await this.graphGet<{ access_token: string }>('/oauth/access_token', {
			client_id: appId,
			client_secret: appSecret,
			redirect_uri: this.redirectUri,
			code,
		});

		const long = await this.graphGet<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
			grant_type: 'fb_exchange_token',
			client_id: appId,
			client_secret: appSecret,
			fb_exchange_token: short.access_token,
		});

		const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null;
		return { token: long.access_token, expiresAt };
	}

	async getMe(userToken: string): Promise<{ id: string; name: string }> {
		return this.graphGet<{ id: string; name: string }>('/me', { fields: 'id,name', access_token: userToken });
	}

	/** Páginas que administra el usuario + su cuenta de IG Business vinculada. */
	async discoverTargets(userToken: string): Promise<DiscoveredTarget[]> {
		const res = await this.graphGet<{
			data: Array<{
				id: string;
				name: string;
				access_token: string;
				instagram_business_account?: { id: string; username?: string };
			}>;
		}>('/me/accounts', {
			fields: 'id,name,access_token,instagram_business_account{id,username}',
			access_token: userToken,
			limit: '100',
		});

		return (res.data ?? []).map(p => ({
			pageId: p.id,
			pageName: p.name,
			pageAccessToken: p.access_token,
			igBusinessAccountId: p.instagram_business_account?.id ?? null,
			igUsername: p.instagram_business_account?.username ?? null,
		}));
	}

	// ── Helper HTTP contra la Graph API ──

	private async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
		const url = `${this.graphBase}${path}?${new URLSearchParams(params).toString()}`;
		const res = await fetch(url);
		const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
		if (!res.ok) {
			throw new BadRequestException(`Meta: ${body?.error?.message || res.statusText}`);
		}
		return body as T;
	}
}
