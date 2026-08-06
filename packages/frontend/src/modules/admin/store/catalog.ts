import { defineStore } from 'pinia';
import type {
	Rubro,
	Producto,
	ProductoWrite,
	BatchProductoItem,
	BatchProductoResult,
	Espacio,
	MetaConnection,
	MetaRubroState,
	MetaNetwork,
	MetaPublishResult,
	MlRubroState,
	MlCategoryPrediction,
	MlAttribute,
	MlPublishResult,
	MlCatalogSearchResult,
	MlCatalogProduct,
	MlImportResult,
	MlFeeBreakdown,
	MlShippingQuote,
	MlListingType,
	MlOrderView,
	MlOrdersSyncResult,
	PaymentProvider,
	PaymentProviderConfigPublic,
	SubscriptionPlan,
	SubscribableRubroPublic,
} from '@base-template/shared';
import { api } from '@/shared/services/api';
import { deleteImage } from '@/shared/utils/image';

interface CatalogState {
	rubros: Rubro[];
	productos: Producto[];
	// Todos los productos del espacio (cualquier rubro) — para la carga masiva.
	allProductos: Producto[];
	// El espacio del admin logueado (para editar su "Sobre Nosotros")
	miEspacio: Espacio | null;
	// Vitrina pública (negocio del dominio actual)
	currentEspacio: Espacio | null;
	siteResolved: boolean;
	publicRubros: Rubro[];
	currentRubro: Rubro | null;
	publicProductos: Producto[];
}

/** Campos editables de la página "Sobre Nosotros". */
export type AboutInput = Partial<
	Pick<Espacio, 'whatsapp' | 'instagramUrl' | 'aboutHeadline' | 'aboutText' | 'aboutImageUrl'>
>;

/** Payloads de creación/edición (el backend infiere el dueño desde el token). */
export type RubroInput = Partial<
	Pick<
		Rubro,
		| 'nombre'
		| 'descripcion'
		| 'imageUrl'
		| 'logoUrl'
		| 'instagramUrl'
		| 'platforms'
		| 'androidUrl'
		| 'iosUrl'
		| 'webUrl'
		| 'status'
		| 'subscriptionsEnabled'
	>
>;
export type ProductoInput = ProductoWrite;

/** Credenciales del proveedor de cobro (los secretos vacíos se conservan). */
export interface PaymentConfigInput {
	provider?: PaymentProvider;
	apiKey?: string;
	storeId?: string;
	webhookSecret?: string;
	active?: boolean;
}

/** Campos de creación/edición de un plan de suscripción. */
export type PlanInput = Partial<
	Pick<
		SubscriptionPlan,
		'nombre' | 'descripcion' | 'precio' | 'moneda' | 'intervalo' | 'provider' | 'providerVariantId' | 'active' | 'orden'
	>
>;

export const useCatalogStore = defineStore('catalog', {
	state: (): CatalogState => ({
		rubros: [],
		productos: [],
		allProductos: [],
		miEspacio: null,
		currentEspacio: null,
		siteResolved: false,
		publicRubros: [],
		currentRubro: null,
		publicProductos: [],
	}),

	getters: {
		activos: (state): number => state.rubros.filter(r => r.status === 'active').length,
		borradores: (state): number => state.rubros.filter(r => r.status === 'draft').length,
		rubroById:
			state =>
			(id: string): Rubro | undefined =>
				state.rubros.find(r => r.id === id),
	},

	actions: {
		// ── Rubros ──
		async fetchRubros(): Promise<void> {
			const { data } = await api.get<Rubro[]>('/rubros');
			this.rubros = data;
		},

		async createRubro(input: RubroInput): Promise<Rubro> {
			const { data } = await api.post<Rubro>('/rubros', input);
			this.rubros.unshift(data);
			return data;
		},

		async updateRubro(id: string, input: RubroInput): Promise<Rubro> {
			const prev = this.rubros.find(r => r.id === id);
			const { data } = await api.patch<Rubro>(`/rubros/${id}`, input);
			const i = this.rubros.findIndex(r => r.id === id);
			if (i !== -1) this.rubros[i] = data;
			// Borra las imágenes reemplazadas (solo tras persistir con éxito).
			if (prev) {
				if (prev.imageUrl !== data.imageUrl) void deleteImage(prev.imageUrl);
				if (prev.logoUrl !== data.logoUrl) void deleteImage(prev.logoUrl);
			}
			return data;
		},

		async deleteRubro(id: string): Promise<void> {
			const prev = this.rubros.find(r => r.id === id);
			await api.delete(`/rubros/${id}`);
			this.rubros = this.rubros.filter(r => r.id !== id);
			if (prev) {
				void deleteImage(prev.imageUrl);
				void deleteImage(prev.logoUrl);
			}
		},

		// ── Productos (de un rubro) ──
		async fetchProductos(rubroId: string): Promise<void> {
			const { data } = await api.get<Producto[]>(`/rubros/${rubroId}/productos`);
			this.productos = data;
		},

		async createProducto(rubroId: string, input: ProductoInput): Promise<Producto> {
			const { data } = await api.post<Producto>(`/rubros/${rubroId}/productos`, input);
			this.productos.unshift(data);
			return data;
		},

		async updateProducto(rubroId: string, id: string, input: ProductoInput): Promise<Producto> {
			const prev = this.productos.find(p => p.id === id);
			const { data } = await api.patch<Producto>(`/rubros/${rubroId}/productos/${id}`, input);
			const i = this.productos.findIndex(p => p.id === id);
			if (i !== -1) this.productos[i] = data;
			if (prev && prev.imageUrl !== data.imageUrl) void deleteImage(prev.imageUrl);
			return data;
		},

		async deleteProducto(rubroId: string, id: string): Promise<void> {
			const prev = this.productos.find(p => p.id === id);
			await api.delete(`/rubros/${rubroId}/productos/${id}`);
			this.productos = this.productos.filter(p => p.id !== id);
			if (prev) void deleteImage(prev.imageUrl);
		},

		// ── Carga masiva (todos los productos del espacio) ──
		/** Trae todos los productos del espacio (de cualquier rubro). */
		async fetchAllProductos(): Promise<void> {
			const { data } = await api.get<Producto[]>('/productos');
			this.allProductos = data;
		},

		/** Alta/edición masiva. Devuelve el resultado por fila (ok/error). */
		async batchUpsert(items: BatchProductoItem[]): Promise<BatchProductoResult[]> {
			const { data } = await api.post<BatchProductoResult[]>('/productos/batch', { items });
			return data;
		},

		// ── Meta (redes sociales) por rubro ──
		/** Estado de Meta del rubro: app configurada + conexión. */
		async fetchMetaState(rubroId: string): Promise<MetaRubroState> {
			const { data } = await api.get<MetaRubroState>(`/rubros/${rubroId}/meta`);
			return data;
		},

		/** Arranca el OAuth: devuelve la URL de consentimiento para redirigir. */
		async connectMeta(rubroId: string): Promise<string> {
			const { data } = await api.post<{ url: string }>(`/rubros/${rubroId}/meta/connect`, {});
			return data.url;
		},

		/** Elige a qué Página/IG publica el rubro. Refleja el cambio local. */
		async setMetaTarget(rubroId: string, metaTargetId: string): Promise<MetaConnection> {
			const { data } = await api.patch<MetaConnection>(`/rubros/${rubroId}/meta/target`, { metaTargetId });
			const rubro = this.rubros.find(r => r.id === rubroId);
			if (rubro) rubro.metaTargetId = metaTargetId;
			return data;
		},

		/** Desconecta la cuenta de Meta del rubro. */
		async disconnectMeta(rubroId: string): Promise<void> {
			await api.delete(`/rubros/${rubroId}/meta`);
			const rubro = this.rubros.find(r => r.id === rubroId);
			if (rubro) rubro.metaTargetId = null;
		},

		/** Publica un producto en las redes del rubro. */
		async publishProducto(
			rubroId: string,
			productoId: string,
			payload: { networks?: MetaNetwork[]; caption?: string; imageUrl?: string } = {},
		): Promise<MetaPublishResult[]> {
			const { data } = await api.post<MetaPublishResult[]>(
				`/rubros/${rubroId}/productos/${productoId}/publish`,
				payload,
			);
			return data;
		},

		// ── Mercado Libre por rubro ──
		/** Estado de ML del rubro: app configurada + conexión. */
		async fetchMlState(rubroId: string): Promise<MlRubroState> {
			const { data } = await api.get<MlRubroState>(`/rubros/${rubroId}/ml`);
			return data;
		},

		/** Arranca el OAuth: devuelve la URL de consentimiento para redirigir. */
		async connectMl(rubroId: string): Promise<string> {
			const { data } = await api.post<{ url: string }>(`/rubros/${rubroId}/ml/connect`, {});
			return data.url;
		},

		/** Desconecta la cuenta de Mercado Libre del rubro. */
		async disconnectMl(rubroId: string): Promise<void> {
			await api.delete(`/rubros/${rubroId}/ml`);
		},

		/** Predice categorías de ML a partir del título del producto. */
		async predictMlCategory(rubroId: string, q: string): Promise<MlCategoryPrediction[]> {
			const { data } = await api.get<MlCategoryPrediction[]>(`/rubros/${rubroId}/ml/categories/predict`, {
				params: { q },
			});
			return data;
		},

		/** Atributos obligatorios de una categoría de ML. */
		async fetchMlAttributes(rubroId: string, categoryId: string): Promise<MlAttribute[]> {
			const { data } = await api.get<MlAttribute[]>(`/rubros/${rubroId}/ml/categories/${categoryId}/attributes`);
			return data;
		},

		/** Busca productos en el catálogo de ML (por nombre o EAN). */
		async searchMlCatalog(rubroId: string, q: string): Promise<MlCatalogSearchResult[]> {
			const { data } = await api.get<MlCatalogSearchResult[]>(`/rubros/${rubroId}/ml/catalog/search`, {
				params: { q },
			});
			return data;
		},

		/** Trae un producto del catálogo listo para autocompletar. */
		async fetchMlCatalogProduct(rubroId: string, productId: string): Promise<MlCatalogProduct> {
			const { data } = await api.get<MlCatalogProduct>(`/rubros/${rubroId}/ml/catalog/${productId}`);
			return data;
		},

		/** Baja las publicaciones activas de la cuenta de ML del rubro a la app. */
		async importMlListings(rubroId: string): Promise<MlImportResult> {
			const { data } = await api.post<MlImportResult>(`/rubros/${rubroId}/ml/import`, {});
			return data;
		},

		/** Publica un producto (ya guardado) en Mercado Libre. */
		async publishToMl(rubroId: string, productoId: string): Promise<MlPublishResult> {
			const { data } = await api.post<MlPublishResult>(`/rubros/${rubroId}/ml/productos/${productoId}/publish`, {});
			return data;
		},

		/** Sincroniza el precio/stock de una publicación existente en Mercado Libre. */
		async updateMlListing(rubroId: string, productoId: string): Promise<MlPublishResult> {
			const { data } = await api.post<MlPublishResult>(`/rubros/${rubroId}/ml/productos/${productoId}/update`, {});
			return data;
		},

		/** Pausa o reactiva la publicación en Mercado Libre. */
		async setMlStatus(rubroId: string, productoId: string, status: 'active' | 'paused'): Promise<MlPublishResult> {
			const { data } = await api.post<MlPublishResult>(`/rubros/${rubroId}/ml/productos/${productoId}/status`, { status });
			return data;
		},

		/** Comisión de ML para un precio (desglose en vivo de la calculadora). */
		async fetchMlFee(
			rubroId: string,
			price: number,
			categoryId: string,
			listingType: MlListingType,
		): Promise<MlFeeBreakdown> {
			const { data } = await api.get<MlFeeBreakdown>(`/rubros/${rubroId}/ml/fee`, {
				params: { price, categoryId, listingType },
			});
			return data;
		},

		/** Sugiere el precio de ML para dejar un neto objetivo (costo + margen) intacto. */
		async suggestMlPrice(
			rubroId: string,
			neto: number,
			categoryId: string,
			listingType: MlListingType,
		): Promise<MlFeeBreakdown> {
			const { data } = await api.get<MlFeeBreakdown>(`/rubros/${rubroId}/ml/suggest-price`, {
				params: { neto, categoryId, listingType },
			});
			return data;
		},

		/** Cotiza el envío gratis de ML (costo del vendedor + si es obligatorio a ese precio). */
		async fetchShippingCost(
			rubroId: string,
			dims: { alto: number; ancho: number; largo: number; peso: number },
			price: number,
			listingType: MlListingType,
		): Promise<MlShippingQuote> {
			const { data } = await api.get<MlShippingQuote>(`/rubros/${rubroId}/ml/shipping-cost`, {
				params: { price, listingType, ...dims },
			});
			return data;
		},

		// ── Ventas de Mercado Libre (panel) ──
		/** Lista las ventas concretadas del rubro (filtro opcional por estado). */
		async fetchMlOrders(rubroId: string, status?: string): Promise<MlOrderView[]> {
			const { data } = await api.get<MlOrderView[]>(`/rubros/${rubroId}/ml/orders`, {
				params: status ? { status } : {},
			});
			return data;
		},

		/** Sincroniza (backfill) el historial de ventas pagadas desde Mercado Libre. */
		async syncMlOrders(rubroId: string): Promise<MlOrdersSyncResult> {
			const { data } = await api.post<MlOrdersSyncResult>(`/rubros/${rubroId}/ml/orders/sync`, {});
			return data;
		},

		/** Baja la etiqueta de envío de una venta como blob ('pdf' o 'zpl' para térmica). */
		async fetchMlLabel(rubroId: string, orderId: string, format: 'pdf' | 'zpl'): Promise<Blob> {
			const { data } = await api.get(`/rubros/${rubroId}/ml/orders/${orderId}/label`, {
				params: { format },
				responseType: 'blob',
			});
			return data as Blob;
		},

		// ── Cobros / Suscripciones (por espacio y por rubro) ──
		/** Config del proveedor de cobro del espacio (vista sin secretos). */
		async fetchPaymentConfig(provider?: PaymentProvider): Promise<PaymentProviderConfigPublic> {
			const { data } = await api.get<PaymentProviderConfigPublic>('/mi-espacio/payment-config', {
				params: provider ? { provider } : undefined,
			});
			return data;
		},

		/** Guarda (upsert) las credenciales del proveedor. */
		async savePaymentConfig(input: PaymentConfigInput): Promise<PaymentProviderConfigPublic> {
			const { data } = await api.put<PaymentProviderConfigPublic>('/mi-espacio/payment-config', input);
			return data;
		},

		/** Planes de suscripción de un rubro. */
		async fetchPlans(rubroId: string): Promise<SubscriptionPlan[]> {
			const { data } = await api.get<SubscriptionPlan[]>(`/mi-espacio/rubros/${rubroId}/plans`);
			return data;
		},

		async createPlan(rubroId: string, input: PlanInput): Promise<SubscriptionPlan> {
			const { data } = await api.post<SubscriptionPlan>(`/mi-espacio/rubros/${rubroId}/plans`, input);
			return data;
		},

		async updatePlan(rubroId: string, planId: string, input: PlanInput): Promise<SubscriptionPlan> {
			const { data } = await api.patch<SubscriptionPlan>(`/mi-espacio/rubros/${rubroId}/plans/${planId}`, input);
			return data;
		},

		async deletePlan(rubroId: string, planId: string): Promise<void> {
			await api.delete(`/mi-espacio/rubros/${rubroId}/plans/${planId}`);
		},

		// ── "Sobre Nosotros" del admin logueado ──
		async fetchMiEspacio(): Promise<void> {
			const { data } = await api.get<Espacio>('/mi-espacio');
			this.miEspacio = data;
		},

		async updateMiEspacio(input: AboutInput): Promise<void> {
			const prev = this.miEspacio;
			const { data } = await api.patch<Espacio>('/mi-espacio', input);
			if (prev && prev.aboutImageUrl !== data.aboutImageUrl) void deleteImage(prev.aboutImageUrl);
			this.miEspacio = data;
		},

		// ── Vitrina pública (negocio del dominio actual) ──
		/**
		 * Resuelve el negocio según el hostname del navegador y carga sus rubros.
		 *  - 'ok'        → negocio activo, vitrina lista
		 *  - 'suspended' → negocio existe pero está suspendido (403)
		 *  - 'notfound'  → no hay negocio en este dominio (404)
		 */
		async resolveSite(): Promise<'ok' | 'suspended' | 'notfound'> {
			try {
				const host = window.location.hostname;
				const { data } = await api.get<{ espacio: Espacio; rubros: Rubro[] }>('/public/site', {
					params: { host },
				});
				this.currentEspacio = data.espacio;
				this.publicRubros = data.rubros;
				this.siteResolved = true;
				return 'ok';
			} catch (e: unknown) {
				this.currentEspacio = null;
				this.siteResolved = false;
				const status = (e as { response?: { status?: number } })?.response?.status;
				return status === 403 ? 'suspended' : 'notfound';
			}
		},

		async fetchPublicRubro(id: string): Promise<void> {
			const { data } = await api.get<Rubro>(`/public/rubros/${id}`);
			this.currentRubro = data;
		},

		async fetchPublicProductos(id: string): Promise<void> {
			const { data } = await api.get<Producto[]>(`/public/rubros/${id}/productos`);
			this.publicProductos = data;
		},

		// ── Suscripciones (vitrina pública) ──
		/** Rubros suscribibles del negocio del dominio actual, con sus planes. */
		async fetchSubscribables(): Promise<SubscribableRubroPublic[]> {
			const host = window.location.hostname;
			const { data } = await api.get<SubscribableRubroPublic[]>('/public/subscriptions', { params: { host } });
			return data;
		},

		/** Inicia el checkout de un plan; devuelve la URL hosteada del proveedor. */
		async createSubscriptionCheckout(planId: string, email: string, name?: string): Promise<string> {
			const { data } = await api.post<{ checkoutUrl: string }>('/public/subscriptions/checkout', {
				planId,
				email,
				...(name ? { name } : {}),
			});
			return data.checkoutUrl;
		},
	},
});
