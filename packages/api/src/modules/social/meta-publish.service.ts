import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { MetaNetwork, MetaPost, MetaPublishResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MetaConnectionService, type ResolvedTarget } from './meta-connection.service';
import { MetaPostEntity } from './entities/meta-post.entity';

/**
 * Publica un producto en las redes de Meta del rubro al que pertenece.
 *  - Facebook: una foto en el feed de la Página (1 paso).
 *  - Instagram: contenedor + publicación (2 pasos), usando la URL pública de la
 *    imagen (las imágenes ya viven en Firebase Storage con URL pública).
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
		opts: { networks?: MetaNetwork[]; caption?: string; imageUrl?: string; story?: boolean },
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

		// Redes pedidas (por defecto todas las posibles: FB siempre, IG si hay cuenta).
		const wanted = opts.networks?.length ? opts.networks : (['facebook', 'instagram'] as MetaNetwork[]);
		const results: MetaPublishResult[] = [];

		if (wanted.includes('facebook')) {
			results.push(await this.publishFacebook(target, imageUrl, caption));
		}
		if (wanted.includes('instagram') && target.igBusinessAccountId) {
			results.push(await this.publishInstagram(target, imageUrl, caption, opts.story));
		}

		if (!results.length) {
			throw new BadRequestException('No hay ninguna red disponible para publicar en este rubro');
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
					imageUrl,
					caption,
					mediaId: r.id ?? null,
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
			return { network: 'facebook', ok: true, id: res.post_id || res.id };
		} catch (e) {
			return { network: 'facebook', ok: false, error: (e as Error).message };
		}
	}

	// ── Instagram: contenedor + publicación ──

	private async publishInstagram(
		target: ResolvedTarget,
		imageUrl: string,
		caption: string,
		story = false,
	): Promise<MetaPublishResult> {
		try {
			const igId = target.igBusinessAccountId!;
			// Historia (9:16) → media_type=STORIES y sin caption; feed → con caption.
			const containerParams: Record<string, string> = { image_url: imageUrl, access_token: target.pageAccessToken };
			if (story) containerParams.media_type = 'STORIES';
			else containerParams.caption = caption;
			const container = await this.graphPost<{ id: string }>(`/${igId}/media`, containerParams);
			const published = await this.graphPost<{ id: string }>(`/${igId}/media_publish`, {
				creation_id: container.id,
				access_token: target.pageAccessToken,
			});
			return { network: 'instagram', ok: true, id: published.id };
		} catch (e) {
			return { network: 'instagram', ok: false, error: (e as Error).message };
		}
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
		const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
		if (!res.ok) {
			throw new Error(body?.error?.message || res.statusText);
		}
		return body as T;
	}
}
