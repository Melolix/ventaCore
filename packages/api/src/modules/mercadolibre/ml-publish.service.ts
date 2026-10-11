import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { matchOpcionAttr, type MlBulkResult, type MlPublishResult } from '@base-template/shared';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { MlConnectionService } from './ml-connection.service';
import { MlCatalogService } from './ml-catalog.service';

/** ¿La etiqueta de la opción parece un talle? (S, M, XL, 3XL, 42, 38.5, Único…) */
const PARECE_TALLE = /^(x{0,4}s|m|x{0,4}l|\d{1,2}x[sl]|u|[uú]nico|talle [uú]nico|\d{1,3}([.,]\d)?)$/i;

/** Atributo de un ítem tal como lo espera la API de ML. */
type MlItemAttribute = { id?: string; name?: string; value_id?: string; value_name: string };

/** Moneda por sitio de ML (los que más nos importan; fallback ARS). */
const CURRENCY_BY_SITE: Record<string, string> = {
	MLA: 'ARS',
	MLB: 'BRL',
	MLM: 'MXN',
	MLC: 'CLP',
	MCO: 'COP',
	MLU: 'UYU',
	MPE: 'PEN',
};

@Injectable()
export class MlPublishService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}
	/**
	 * Tipo de publicación a usar. En desarrollo con test users, `ML_LISTING_TYPE_ID`
	 * (ej. "bronze") fuerza uno gratis para no gastar. En producción no se setea y
	 * manda el que eligió el producto (gold_special/gold_pro).
	 */
	private listingTypeFor(producto: ProductoEntity): string {
		return process.env.ML_LISTING_TYPE_ID || producto.mlListingType || 'gold_special';
	}

	constructor(
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly connections: MlConnectionService,
		private readonly catalog: MlCatalogService,
	) {}

	/**
	 * Atributos de VARIANTE de un producto con opciones (talle, color…). En el
	 * modelo actual de ML cada opción es una publicación propia y ML las junta en
	 * una sola página solo si comparten el nombre de familia y traen cargado, con
	 * distinto valor, el atributo con el que la categoría permite variar. Sin esto
	 * salían N publicaciones idénticas.
	 *
	 * Por cada parte de la etiqueta ("Azul / M" → "Azul", "M") se elige:
	 *  1) el atributo de variación cuya lista de valores contiene esa opción;
	 *  2) si parece un talle y la categoría tiene SIZE, ese;
	 *  3) si no, un atributo propio "Opción" (ML admite atributos custom y
	 *     también los usa para distinguir variantes de una familia).
	 */
	/**
	 * Guía de talles: si el producto tiene una elegida (`SIZE_GRID_ID` en su
	 * ficha), cada publicación tiene que apuntar a la FILA de su talle
	 * (`SIZE_GRID_ROW_ID`) y usar el talle tal como figura en la guía. Si el talle
	 * no está en la guía se corta con un mensaje claro: ML lo rechazaría igual,
	 * pero con un error ilegible.
	 */
	private async sizeGridAttributes(
		producto: ProductoEntity,
		talle: string | undefined,
		accessToken: string,
		siteId: string,
	): Promise<MlItemAttribute[]> {
		const chartId = String(producto.atributos?.SIZE_GRID_ID ?? '').trim();
		if (!chartId || !talle?.trim()) return [];
		const chart = await this.catalog.getSizeChart(accessToken, siteId, chartId);
		const norm = (s: string) => s.trim().toLowerCase();
		// ML exige que el género del producto sea el de la guía (si no, responde un
		// "Attribute [GENDER] is not valid" que no dice por qué).
		const genero = String(producto.atributos?.GENDER ?? '').trim();
		if (chart.gender && genero && norm(chart.gender) !== norm(genero)) {
			throw new BadRequestException(
				`La guía de talles "${chart.name}" es de género "${chart.gender}" y el producto dice "${genero}". Tienen que coincidir: cambiá el género del producto o elegí otra guía.`,
			);
		}
		const fila = chart.rows.find(r => norm(r.size) === norm(talle));
		if (!fila) {
			throw new BadRequestException(
				`El talle "${talle.trim()}" no está en la guía de talles "${chart.name}" (tiene: ${chart.rows.map(r => r.size).join(', ') || 'ninguno'}). Elegí otra guía o agregale ese talle en Mercado Libre.`,
			);
		}
		return [
			{ id: 'SIZE', value_name: fila.size },
			{ id: 'SIZE_GRID_ROW_ID', value_name: fila.id },
		];
	}

	private async variantAttributes(producto: ProductoEntity): Promise<MlItemAttribute[]> {
		const etiqueta = producto.variante?.trim();
		if (!producto.grupo || !etiqueta || !producto.mlCategoryId) return [];

		// Opciones con nombre (lo normal): cada característica va al atributo de ML
		// que le corresponde por nombre ("Peso" → Peso neto, "Talle" → SIZE). La que
		// no tiene equivalente viaja como atributo propio, con su nombre.
		const opciones = (producto.opciones ?? []).filter(o => o?.nombre?.trim() && o?.valor?.trim());
		if (opciones.length) {
			const attrs = await this.catalog
				.getVariationAttributes(producto.mlCategoryId)
				.catch((): Awaited<ReturnType<MlCatalogService['getVariationAttributes']>> => []);
			const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
			const tomados = new Set<string>();
			return opciones.map(o => {
				const attr = matchOpcionAttr(o.nombre, attrs.filter(a => !tomados.has(a.id)));
				if (!attr) return { name: o.nombre.trim(), value_name: o.valor.trim() };
				tomados.add(attr.id);
				const valor = attr.values.find(v => igual(v.name, o.valor));
				return valor ? { id: attr.id, value_id: valor.id, value_name: valor.name } : { id: attr.id, value_name: o.valor.trim() };
			});
		}

		// Sin nombres (cargadas antes de que existieran): se deduce por el valor.
		const partes = etiqueta.split(' / ').map(s => s.trim()).filter(Boolean);
		// Si ML no responde, seguimos sin candidatos: la opción va como atributo propio.
		const candidatos = (
			await this.catalog.getVariationAttributes(producto.mlCategoryId).catch((): Awaited<ReturnType<MlCatalogService['getVariationAttributes']>> => [])
		).filter(a => a.allowVariations);
		const norm = (s: string) => s.trim().toLowerCase();
		const usados = new Set<string>();
		const out: MlItemAttribute[] = [];
		partes.forEach((parte, i) => {
			const libres = candidatos.filter(a => !usados.has(a.id));
			let attr = libres.find(a => a.values.some(v => norm(v.name) === norm(parte)));
			if (!attr && PARECE_TALLE.test(parte)) attr = libres.find(a => a.id === 'SIZE');
			if (attr) {
				usados.add(attr.id);
				const valor = attr.values.find(v => norm(v.name) === norm(parte));
				out.push(valor ? { id: attr.id, value_id: valor.id, value_name: valor.name } : { id: attr.id, value_name: parte });
			} else {
				out.push({ name: partes.length > 1 ? `Opción ${i + 1}` : 'Opción', value_name: parte });
			}
		});
		return out;
	}

	/** Arma el ítem tal como se le manda a ML (lo usan publicar y la validación en seco). */
	private async buildItemPayload(
		producto: ProductoEntity,
		precioPublicacion: number | null,
		accessToken: string,
		siteId: string,
		subirFotos = false,
	): Promise<Record<string, unknown>> {
		const common = {
			price: precioPublicacion,
			currency_id: CURRENCY_BY_SITE[siteId] ?? 'ARS',
			available_quantity: producto.stock,
			buying_mode: 'buy_it_now',
			condition: 'new',
			listing_type_id: this.listingTypeFor(producto),
		};

		let payload: Record<string, unknown>;
		if (producto.mlCatalogProductId) {
			// Enlazado al catálogo: ML hereda atributos, título y fotos. Igual mandamos
			// la categoría si la tenemos (algunos productos de catálogo la exigen).
			payload = {
				...common,
				catalog_product_id: producto.mlCatalogProductId,
				catalog_listing: true,
				...(producto.mlCategoryId ? { category_id: producto.mlCategoryId } : {}),
			};
		} else {
			// Con opciones: el atributo de variante (talle, color…) de ESTA opción. Pisa
			// al que venga igual en la ficha común (p. ej. un Color cargado para todas).
			const variantes = await this.variantAttributes(producto);
			// Guía de talles (ropa): la fila que corresponde al talle de esta publicación.
			const talle = variantes.find(v => v.id === 'SIZE')?.value_name ?? (producto.atributos?.SIZE as string | undefined);
			const grilla = await this.sizeGridAttributes(producto, talle, accessToken, siteId);
			if (grilla.length) {
				const i = variantes.findIndex(v => v.id === 'SIZE');
				if (i !== -1) variantes.splice(i, 1);
				variantes.push(...grilla);
			}
			const pisados = new Set(variantes.map(v => v.id).filter(Boolean));
			const attributes: MlItemAttribute[] = [
				...Object.entries(producto.atributos ?? {})
					.filter(([id, value]) => !pisados.has(id) && value && String(value).trim())
					.map(([id, value]) => ({ id, value_name: String(value).trim() })),
				...variantes,
			];
			// Galería completa; si no hay, la portada; si tampoco, sin fotos.
			let urls = producto.imagenes?.length ? producto.imagenes : producto.imageUrl ? [producto.imageUrl] : [];
			// Producto con opciones: las fotos se cargan una vez. Si a esta opción le
			// faltan, usa las de otra del mismo producto (ML exige al menos una).
			if (!urls.length && producto.grupo) {
				const hermanas = await this.productos.find({ where: { rubroId: producto.rubroId, grupo: producto.grupo } });
				const conFotos = hermanas.find(h => h.imagenes?.length || h.imageUrl);
				if (conFotos) urls = conFotos.imagenes?.length ? conFotos.imagenes : [conFotos.imageUrl as string];
			}
			// Al publicar de verdad le subimos los archivos a ML (ver `mlPictures`); en
			// la validación en seco alcanza con la dirección.
			const pictures = subirFotos ? await this.mlPictures(urls, accessToken) : urls.map(source => ({ source }));
			payload = {
				...common,
				// En el modelo actual de ML se manda `family_name` (NO `title`): ML arma
				// el título solo a partir de la familia + los atributos del ítem.
				family_name: producto.nombre.trim(),
				category_id: producto.mlCategoryId,
				...(pictures.length ? { pictures } : {}),
				...(attributes.length ? { attributes } : {}),
			};
		}
		return payload;
	}

	/**
	 * Validación en seco: arma el MISMO ítem que publicar y se lo pasa al validador
	 * de ML (`/items/validate`), que lo revisa sin crear nada. Sirve para ver por
	 * qué ML rechazaría una publicación antes de intentarla.
	 */
	async validate(rubroId: string, espacioId: string, productoId: string): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const payload = await this.buildItemPayload(producto, producto.precioMl ?? producto.precio, accessToken, siteId);
		const res = await fetch(`${this.apiHost}/items/validate`, {
			method: 'POST',
			headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify(payload),
		});
		if (res.ok) return { ok: true, errors: [], warnings: [] };
		const data = (await res.json().catch(() => ({}))) as { message?: string; cause?: unknown };
		const { errors, warnings } = MlPublishService.splitCauses(data.cause);
		// El validador responde 400 aunque solo haya advertencias (ML completa un
		// dato, envío gratis obligatorio…): eso NO bloquea la publicación.
		if (!errors.length && warnings.length) return { ok: true, errors: [], warnings };
		// Sin errores tipificados: devolvemos lo que haya mandado ML, para poder leerlo.
		const crudo = errors.length ? [] : [`${data.message || res.statusText} ${JSON.stringify(data).slice(0, 900)}`];
		return { ok: false, errors: errors.length ? errors : crudo, warnings };
	}

	/**
	 * Diagnóstico de una publicación: cómo la agrupó ML (producto de usuario y
	 * familia) y con qué atributos quedó. Las opciones de un mismo artículo se ven
	 * juntas solo si comparten `familyId`.
	 */
	async inspect(rubroId: string, espacioId: string, productoId: string): Promise<Record<string, unknown>> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto?.mlItemId) throw new NotFoundException('El producto no está publicado en Mercado Libre');
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const get = async (path: string) => {
			const res = await fetch(`${this.apiHost}${path}`, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
			return (await res.json().catch(() => ({}))) as Record<string, unknown>;
		};
		const item = await get(`/items/${producto.mlItemId}`);
		const upId = item.user_product_id as string | undefined;
		const up = upId ? await get(`/user-products/${upId}`) : {};
		const attrs = ((item.attributes as Array<{ id?: string; value_name?: string }>) ?? []).reduce<Record<string, string>>((acc, a) => {
			if (a.id && a.value_name) acc[a.id] = a.value_name;
			return acc;
		}, {});
		return {
			itemId: item.id,
			title: item.title,
			familyName: item.family_name,
			status: item.status,
			subStatus: item.sub_status,
			pictures: ((item.pictures as Array<{ id?: string; url?: string; size?: string }>) ?? []).map(x => ({ id: x.id, url: x.url, size: x.size })),
			tags: item.tags,
			userProductId: upId ?? null,
			familyId: up.family_id != null ? String(up.family_id) : null,
			userProductName: up.name ?? null,
			attributes: attrs,
		};
	}

	/** Separa los motivos que devuelve ML en errores (bloquean) y advertencias (no). */
	private static splitCauses(cause: unknown): { errors: string[]; warnings: string[] } {
		const list = Array.isArray(cause) ? (cause as Array<{ type?: string; code?: string; message?: string }>) : [];
		const fmt = (c: { code?: string; message?: string }) => [c.message, c.code ? `[${c.code}]` : ''].filter(Boolean).join(' ');
		return {
			errors: list.filter(c => c.type !== 'warning').map(fmt),
			warnings: list.filter(c => c.type === 'warning').map(fmt),
		};
	}

	/**
	 * Publica un producto en Mercado Libre. Valida datos mínimos, arma el ítem,
	 * lo crea, le carga la descripción y guarda el id/permalink en el producto.
	 */
	async publish(rubroId: string, espacioId: string, productoId: string): Promise<MlPublishResult> {
		// El rubro debe ser del espacio; el producto, del rubro.
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');

		// Precio a publicar en ML: el de ML si está calculado; si no, el de tienda.
		const precioPublicacion = producto.precioMl ?? producto.precio;

		// Datos obligatorios para publicar.
		const faltan: string[] = [];
		if (!producto.nombre?.trim()) faltan.push('nombre');
		if (precioPublicacion == null) faltan.push('precio');
		if (producto.stock == null) faltan.push('stock');
		// La categoría la exigimos solo si NO se enlaza al catálogo (ahí la pone ML).
		if (!producto.mlCategoryId && !producto.mlCatalogProductId) faltan.push('categoría de ML');
		if (faltan.length) {
			throw new BadRequestException(`Faltan datos para publicar en Mercado Libre: ${faltan.join(', ')}`);
		}

		// ML rechaza lo que está por debajo del mínimo de la categoría; lo decimos antes y claro.
		await this.catalog.assertMinPrice(producto.mlCategoryId, precioPublicacion);

		const { accessToken, siteId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const payload = await this.buildItemPayload(producto, precioPublicacion, accessToken, siteId, true);

		// 1) Crear el ítem.
		const created = await this.mlPost<{ id?: string; permalink?: string; status?: string }>('/items', accessToken, payload);
		const itemId = created.id;
		if (!itemId) throw new BadRequestException('Mercado Libre no devolvió el id de la publicación');

		// 2) Cargar la descripción (endpoint aparte), si hay.
		if (producto.descripcion?.trim()) {
			await this.mlPost(`/items/${itemId}/description`, accessToken, { plain_text: producto.descripcion.trim() }).catch(
				() => undefined, // la publicación ya existe; no fallamos por la descripción
			);
		}

		// 3) Guardar el resultado en el producto.
		producto.mlItemId = itemId;
		producto.mlPermalink = created.permalink ?? null;
		producto.mlStatus = created.status ?? 'active';
		await this.productos.save(producto);

		return { ok: true, itemId, permalink: created.permalink };
	}

	/**
	 * Pausa o reactiva una publicación en Mercado Libre (PUT status) y guarda el
	 * nuevo estado en el producto.
	 */
	async setStatus(rubroId: string, espacioId: string, productoId: string, status: 'active' | 'paused'): Promise<MlPublishResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		if (!producto.mlItemId) throw new BadRequestException('El producto no está publicado en Mercado Libre');

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const updated = await this.mlPut<{ id?: string; status?: string }>(`/items/${producto.mlItemId}`, accessToken, { status });
		producto.mlStatus = updated.status ?? status;
		// Activarla a mano la saca del modo vacaciones.
		if (status === 'active') producto.mlVacation = false;
		await this.productos.save(producto);
		return { ok: true, itemId: producto.mlItemId, permalink: producto.mlPermalink ?? undefined };
	}

	/**
	 * Pausa o reactiva VARIAS publicaciones. Va de a 4 (ML limita los pedidos) y no
	 * se corta por una que falle: devuelve cuáles no se pudieron y por qué (ML no
	 * deja activar, por ejemplo, una publicación en revisión o sin fotos).
	 * `vacation`: marca (true) o desmarca (false) las que cambian como pausadas por vacaciones.
	 */
	private async bulkStatus(productos: ProductoEntity[], accessToken: string, status: 'active' | 'paused', vacation?: boolean): Promise<MlBulkResult> {
		const out: MlBulkResult = { ok: 0, failed: [] };
		const queue = productos.filter(p => p.mlItemId);
		const worker = async () => {
			for (;;) {
				const p = queue.shift();
				if (!p) return;
				try {
					const updated = await this.mlPut<{ status?: string }>(`/items/${p.mlItemId}`, accessToken, { status });
					p.mlStatus = updated.status ?? status;
					if (vacation !== undefined) p.mlVacation = vacation;
					// Activarla a mano la saca del modo vacaciones.
					else if (status === 'active') p.mlVacation = false;
					await this.productos.save(p);
					out.ok++;
				} catch (e) {
					// ML contesta en inglés y con el detalle técnico ("Cannot update item …
					// [status:under_review]"): se traduce a algo que el dueño pueda entender,
					// y de paso se guarda el estado real que informó.
					const raw = e instanceof Error ? e.message : '';
					const real = /status:([a-z_]+)/.exec(raw)?.[1];
					if (real && real !== p.mlStatus) {
						p.mlStatus = real;
						await this.productos.save(p).catch(() => undefined);
					}
					const motivos: Record<string, string> = {
						under_review: 'está en revisión en Mercado Libre y no se puede cambiar hasta que termine',
						inactive: 'Mercado Libre la tiene inactiva; hay que reactivarla desde Mercado Libre',
						closed: 'está finalizada en Mercado Libre',
						payment_required: 'tiene un pago pendiente en Mercado Libre',
					};
					const error = (real && motivos[real]) || raw.replace(/^Mercado Libre:\s*/, '').replace(/\s*\(\[.*$/s, '') || 'Mercado Libre no aceptó el cambio';
					out.failed.push({ id: p.id, nombre: p.variante ? `${p.nombre} (${p.variante})` : p.nombre, error });
				}
			}
		};
		await Promise.all([worker(), worker(), worker(), worker()]);
		return out;
	}

	/** Pausa o reactiva las publicaciones elegidas (acción en lote de la pantalla de Publicaciones). */
	async setStatusMany(rubroId: string, espacioId: string, ids: string[], status: 'active' | 'paused'): Promise<MlBulkResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		if (!ids.length) return { ok: 0, failed: [] };
		const productos = await this.productos.find({ where: { rubroId, id: In(ids) } });
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		return this.bulkStatus(productos, accessToken, status);
	}

	/**
	 * Modo vacaciones. Al activarlo pausa TODAS las publicaciones activas del
	 * negocio y las marca; al desactivarlo reactiva solo las marcadas (las que el
	 * dueño ya tenía pausadas antes siguen pausadas).
	 */
	async setVacation(rubroId: string, espacioId: string, on: boolean): Promise<MlBulkResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const productos = on
			? await this.productos.find({ where: { rubroId, mlStatus: 'active' } })
			: await this.productos.find({ where: { rubroId, mlVacation: true } });
		if (!productos.length) return { ok: 0, failed: [] };
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		return this.bulkStatus(productos, accessToken, on ? 'paused' : 'active', on);
	}

	/**
	 * Sincroniza una publicación YA existente en Mercado Libre con los datos del
	 * producto (precio y stock). Es lo que corre cuando el usuario cambia el precio
	 * de algo que ya está publicado: sin esto, el cambio queda solo en la app.
	 */
	async updateListing(rubroId: string, espacioId: string, productoId: string): Promise<MlPublishResult> {
		const rubro = await this.rubros.findOne({ where: { id: rubroId, espacioId } });
		if (!rubro) throw new NotFoundException('Rubro no encontrado');
		const producto = await this.productos.findOne({ where: { id: productoId, rubroId } });
		if (!producto) throw new NotFoundException('Producto no encontrado en el rubro');
		if (!producto.mlItemId) throw new BadRequestException('El producto no está publicado en Mercado Libre');

		const precio = producto.precioMl ?? producto.precio;
		if (precio == null) throw new BadRequestException('El producto no tiene precio');
		await this.catalog.assertMinPrice(producto.mlCategoryId, precio);

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const payload: Record<string, unknown> = { price: precio };
		if (producto.stock != null) payload.available_quantity = producto.stock;

		const updated = await this.mlPut<{ id?: string; permalink?: string }>(
			`/items/${producto.mlItemId}`,
			accessToken,
			payload,
		);

		// Imágenes: PUT aparte y best-effort (una foto que ML no pueda bajar no debe
		// romper la sincronización de precio/stock). La primera es la portada.
		const urls = producto.imagenes?.length ? producto.imagenes : producto.imageUrl ? [producto.imageUrl] : [];
		if (urls.length) {
			await this.mlPictures(urls, accessToken)
				.then(pictures => this.mlPut(`/items/${producto.mlItemId}`, accessToken, { pictures }))
				.catch(() => undefined);
		}

		// La descripción va por un endpoint aparte. Upsert best-effort: PUT actualiza
		// la existente; si el item todavía no tenía descripción, el PUT falla y la
		// creamos con POST. No fallamos la sync de precio/stock por la descripción.
		if (producto.descripcion?.trim()) {
			const body = { plain_text: producto.descripcion.trim() };
			await this.mlPut(`/items/${producto.mlItemId}/description`, accessToken, body).catch(() =>
				this.mlPost(`/items/${producto.mlItemId}/description`, accessToken, body).catch(() => undefined),
			);
		}

		if (updated.permalink && updated.permalink !== producto.mlPermalink) {
			producto.mlPermalink = updated.permalink;
			await this.productos.save(producto);
		}
		return { ok: true, itemId: producto.mlItemId, permalink: producto.mlPermalink ?? undefined };
	}

	/**
	 * Fotos del ítem. En vez de pasarle a ML la dirección para que la baje (lo hace
	 * después, por su cuenta, y cuando no puede la publicación queda sin foto y
	 * pausada: "picture_download_pending"), bajamos el archivo acá y se lo subimos:
	 * así la foto ya está en ML cuando se crea la publicación, y si falla nos
	 * enteramos en el momento. Las que ya son de ML se referencian por dirección.
	 */
	private async mlPictures(urls: string[], accessToken: string): Promise<Array<{ id: string } | { source: string }>> {
		const out: Array<{ id: string } | { source: string }> = [];
		for (const url of urls) {
			if (/^https?:\/\/[^/]*(mlstatic\.com|mercadolibre\.com)\//i.test(url)) {
				out.push({ source: url });
				continue;
			}
			const file = await fetch(url).catch(() => null);
			if (!file?.ok) {
				throw new BadRequestException('No se pudo leer una de las fotos del producto para subirla a Mercado Libre. Volvé a cargarla y probá de nuevo.');
			}
			const type = (file.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
			const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
			const form = new FormData();
			form.append('file', new Blob([await file.arrayBuffer()], { type }), `foto.${ext}`);
			const res = await fetch(`${this.apiHost}/pictures/items/upload`, {
				method: 'POST',
				headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
				body: form,
			});
			const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
			if (!res.ok || !data.id) {
				throw new BadRequestException(
					`Mercado Libre no aceptó una de las fotos${data.message ? `: ${data.message}` : ''}. Probá con otra (JPG o PNG, de al menos 500 px).`,
				);
			}
			out.push({ id: data.id });
		}
		return out;
	}

	private async mlPut<T>(path: string, accessToken: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.apiHost}${path}`, {
			method: 'PUT',
			headers: {
				authorization: `Bearer ${accessToken}`,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: JSON.stringify(body),
		});
		const data = (await res.json().catch(() => ({}))) as { message?: string; cause?: unknown };
		if (!res.ok) {
			const cause = data.cause ? ` (${JSON.stringify(data.cause).slice(0, 300)})` : '';
			throw new BadRequestException(`Mercado Libre: ${data.message || res.statusText}${cause}`);
		}
		return data as T;
	}

	private async mlPost<T>(path: string, accessToken: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.apiHost}${path}`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${accessToken}`,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: JSON.stringify(body),
		});
		const data = (await res.json().catch(() => ({}))) as { message?: string; cause?: unknown };
		if (!res.ok) {
			// ML devuelve el detalle en `cause`: mostramos los ERRORES (lo que bloquea),
			// completos. Las advertencias no impiden publicar y tapaban el motivo real.
			const { errors } = MlPublishService.splitCauses(data.cause);
			const detalle = errors.length ? errors.join(' · ') : data.cause ? JSON.stringify(data.cause).slice(0, 600) : '';
			throw new BadRequestException(`Mercado Libre: ${detalle || data.message || res.statusText}`);
		}
		return data as T;
	}
}
