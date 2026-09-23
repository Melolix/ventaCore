import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { MetaNetwork, MetaPost, MetaPostKind, MetaPublishResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MetaConnectionService, type ResolvedTarget } from './meta-connection.service';
import { MetaPostEntity } from './entities/meta-post.entity';

/**
 * Publica un producto en las redes de Meta del rubro al que pertenece.
 *  - Facebook: una foto en el feed de la Página (1 paso).
 *  - Instagram: contenedor + publicación (2 pasos), usando la URL pública de la
 *    imagen (las imágenes ya viven en Firebase Storage con URL pública). Sirve
 *    tanto para el feed (`kind: 'post'`) como para Historias (`kind: 'story'`,
 *    `media_type=STORIES`, sin caption, expiran a las 24 h).
 *
 * Cada publicación exitosa se guarda en `meta_posts` para el historial del
 * estudio ("Publicaciones recientes").
 */
@Injectable()
export class MetaPublishService {
	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		@InjectRepository(MetaPostEntity)
		private readonly posts: Repository<MetaPostEntity>,
		private readonly connections: MetaConnectionService,
	) {}

	private get version(): string {
		return process.env.META_GRAPH_VERSION || 'v21.0';
	}
	private get graphBase(): string {
		return `https://graph.facebook.com/${this.version}`;
	}

	async publishProducto(
		productoId: string,
		rubroId: string,
		espacioId: string,
		opts: { networks?: MetaNetwork[]; caption?: string; imageUrl?: string; kind?: MetaPostKind },
	): Promise<MetaPublishResult[]> {
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado');

		// Override de imagen (para probar con una URL pública JPEG). Si no, la del producto.
		const imageUrl = opts.imageUrl?.trim() || producto.imageUrl;
		if (!imageUrl) {
			throw new BadRequestException('El producto necesita una imagen para publicar en redes');
		}

		const target = await this.connections.resolveTargetForRubro(rubroId, espacioId);
		const caption = opts.caption?.trim() || this.defaultCaption(producto);
		const kind: MetaPostKind = opts.kind === 'story' ? 'story' : 'post';

		// Redes pedidas (por defecto todas las posibles: FB siempre, IG si hay cuenta).
		// Las Historias son exclusivas de Instagram: si piden una, Facebook queda afuera.
		const wanted = opts.networks?.length ? opts.networks : (['facebook', 'instagram'] as MetaNetwork[]);
		const results: MetaPublishResult[] = [];

		if (kind === 'post' && wanted.includes('facebook')) {
			results.push(await this.publishFacebook(target, imageUrl, caption));
		}
		if (wanted.includes('instagram') && target.igBusinessAccountId) {
			results.push(await this.publishInstagram(target, imageUrl, caption, kind));
		}

		// Token rechazado por Meta (code 190: vencido, revocado o contraseña cambiada):
		// la conexión queda marcada para que el panel pida reconectar.
		if (results.some(r => !r.ok && /\(code 190\b/.test(r.error ?? ''))) {
			await this.connections.markExpired(rubroId);
		}

		if (!results.length) {
			throw new BadRequestException(
				kind === 'story'
					? 'Para publicar Historias el rubro necesita una cuenta de Instagram Business vinculada'
					: 'No hay ninguna red disponible para publicar en este rubro',
			);
		}

		// Guardamos las publicaciones exitosas para el historial del estudio.
		const okRows = results
			.filter(r => r.ok)
			.map(r =>
				this.posts.create({
					rubroId,
					espacioId,
					productoId: producto.id,
					network: r.network,
					kind: r.kind,
					imageUrl,
					// En las Historias Instagram ignora el texto: no lo guardamos para no
					// dar a entender en el historial que se publicó algo que no se ve.
					caption: r.kind === 'story' ? null : caption,
					mediaId: r.id ?? null,
					permalink: r.permalink ?? null,
					status: 'published',
				}),
			);
		if (okRows.length) await this.posts.save(okRows);

		return results;
	}

	/** Lista las publicaciones del rubro (historial del estudio), más nuevas primero. */
	async listPosts(rubroId: string, espacioId: string, limit = 30): Promise<MetaPost[]> {
		const rows = await this.posts.find({
			where: { rubroId, espacioId },
			order: { createdAt: 'DESC' },
			take: limit,
		});
		// Resolvemos el nombre del producto para mostrarlo en el historial.
		const prodIds = [...new Set(rows.map(r => r.productoId).filter(Boolean) as string[])];
		const prods = prodIds.length ? await this.productos.find({ where: { id: In(prodIds) } }) : [];
		const nombreById = new Map(prods.map(p => [p.id, p.nombre]));
		return rows.map(r => ({
			id: r.id,
			network: r.network,
			kind: r.kind ?? 'post',
			productoId: r.productoId,
			productoNombre: r.productoId ? (nombreById.get(r.productoId) ?? null) : null,
			imageUrl: r.imageUrl,
			caption: r.caption,
			mediaId: r.mediaId,
			permalink: r.permalink,
			status: r.status,
			createdAt: r.createdAt.toISOString(),
		}));
	}

	// ── Facebook: foto en el feed de la Página ──

	private async publishFacebook(target: ResolvedTarget, imageUrl: string, caption: string): Promise<MetaPublishResult> {
		try {
			const res = await this.graphPost<{ id?: string; post_id?: string }>(`/${target.pageId}/photos`, {
				url: imageUrl,
				caption,
				access_token: target.pageAccessToken,
			});
			return { network: 'facebook', kind: 'post', ok: true, id: res.post_id || res.id };
		} catch (e) {
			return { network: 'facebook', kind: 'post', ok: false, error: (e as Error).message };
		}
	}

	// ── Instagram: contenedor + publicación ──

	private async publishInstagram(
		target: ResolvedTarget,
		imageUrl: string,
		caption: string,
		kind: MetaPostKind,
	): Promise<MetaPublishResult> {
		const igId = target.igBusinessAccountId!;
		try {
			// Historia (9:16) → media_type=STORIES y sin caption; feed → con caption.
			const containerParams: Record<string, string> = { image_url: imageUrl, access_token: target.pageAccessToken };
			if (kind === 'story') containerParams.media_type = 'STORIES';
			else containerParams.caption = caption;

			const container = await this.graphPost<{ id: string }>(`/${igId}/media`, containerParams);
			// Meta baja la imagen de la URL en segundo plano: si publicamos antes de
			// que termine, falla. Esperamos a que el contenedor quede FINISHED.
			await this.waitForContainer(container.id, target.pageAccessToken);

			const published = await this.graphPost<{ id: string }>(`/${igId}/media_publish`, {
				creation_id: container.id,
				access_token: target.pageAccessToken,
			});
			// El permalink solo tiene sentido para el feed: la historia no deja link público.
			const permalink = kind === 'story' ? null : await this.fetchPermalink(published.id, target.pageAccessToken);
			return { network: 'instagram', kind, ok: true, id: published.id, permalink: permalink ?? undefined };
		} catch (e) {
			return { network: 'instagram', kind, ok: false, error: this.igErrorMessage(e as Error, kind) };
		}
	}

	/**
	 * Espera a que el contenedor de IG termine de procesarse (`status_code`):
	 * FINISHED = listo para publicar, ERROR/EXPIRED = no va a salir.
	 */
	private async waitForContainer(containerId: string, accessToken: string, tries = 10): Promise<void> {
		for (let i = 0; i < tries; i++) {
			const { status_code, status } = await this.graphGet<{ status_code?: string; status?: string }>(
				`/${containerId}`,
				{ fields: 'status_code,status', access_token: accessToken },
			);
			if (!status_code || status_code === 'FINISHED') return;
			if (status_code === 'ERROR' || status_code === 'EXPIRED') {
				throw new Error(status || `Instagram no pudo procesar la imagen (${status_code})`);
			}
			// IN_PROGRESS → esperamos un poco y volvemos a preguntar.
			await new Promise(r => setTimeout(r, 1500));
		}
		throw new Error('Instagram tardó demasiado en procesar la imagen. Probá de nuevo en un minuto.');
	}

	/** Link público del post recién publicado (best-effort: si falla, queda null). */
	private async fetchPermalink(mediaId: string, accessToken: string): Promise<string | null> {
		try {
			const res = await this.graphGet<{ permalink?: string }>(`/${mediaId}`, {
				fields: 'permalink',
				access_token: accessToken,
			});
			return res.permalink ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Mensaje de error de Instagram con una pista útil cuando el motivo típico es
	 * la cuenta: la API solo publica Historias desde cuentas **Business** (las de
	 * Creador no pueden) y con `instagram_content_publish` concedido.
	 */
	private igErrorMessage(e: Error, kind: MetaPostKind): string {
		const msg = e.message;
		if (kind !== 'story') return msg;
		const looksLikeAccountIssue = /permission|not supported|media_type|unsupported|business/i.test(msg);
		return looksLikeAccountIssue
			? `${msg} — para publicar Historias la cuenta de Instagram tiene que ser Business (las de Creador no pueden) y la app necesita el permiso instagram_content_publish.`
			: msg;
	}

	private defaultCaption(producto: ProductoEntity): string {
		const parts = [producto.nombre];
		if (producto.descripcion) parts.push(producto.descripcion);
		if (producto.precio != null) {
			parts.push(new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(producto.precio));
		}
		return parts.join('\n\n');
	}

	private async graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
		const res = await fetch(`${this.graphBase}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(params).toString(),
		});
		return this.graphResult<T>(res);
	}

	private async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
		const res = await fetch(`${this.graphBase}${path}?${new URLSearchParams(params).toString()}`);
		return this.graphResult<T>(res);
	}

	private async graphResult<T>(res: Response): Promise<T> {
		const body = (await res.json().catch(() => ({}))) as {
			error?: { message?: string; code?: number; error_subcode?: number };
		};
		if (!res.ok) {
			const err = body?.error;
			const code = err?.code != null ? ` (code ${err.code}${err.error_subcode ? '/' + err.error_subcode : ''})` : '';
			throw new Error(`${err?.message || res.statusText}${code}`);
		}
		return body as T;
	}
}
