import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MetaNetwork, MetaPublishResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MetaConnectionService, type ResolvedTarget } from './meta-connection.service';

/**
 * Publica un producto en las redes de Meta del rubro al que pertenece.
 *  - Facebook: una foto en el feed de la Página (1 paso).
 *  - Instagram: contenedor + publicación (2 pasos), usando la URL pública de la
 *    imagen (las imágenes ya viven en Firebase Storage con URL pública).
 */
@Injectable()
export class MetaPublishService {
	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
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
		opts: { networks?: MetaNetwork[]; caption?: string; imageUrl?: string },
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
			results.push(await this.publishInstagram(target, imageUrl, caption));
		}

		if (!results.length) {
			throw new BadRequestException('No hay ninguna red disponible para publicar en este rubro');
		}
		return results;
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

	private async publishInstagram(target: ResolvedTarget, imageUrl: string, caption: string): Promise<MetaPublishResult> {
		try {
			const igId = target.igBusinessAccountId!;
			const container = await this.graphPost<{ id: string }>(`/${igId}/media`, {
				image_url: imageUrl,
				caption,
				access_token: target.pageAccessToken,
			});
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
