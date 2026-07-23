import { defineStore } from 'pinia';
import type {
	Rubro,
	Producto,
	Espacio,
	MetaConnection,
	MetaRubroState,
	MetaNetwork,
	MetaPublishResult,
} from '@base-template/shared';
import { api } from '@/shared/services/api';
import { deleteImage } from '@/shared/utils/image';

interface CatalogState {
	rubros: Rubro[];
	productos: Producto[];
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
	>
>;
export type ProductoInput = Partial<Pick<Producto, 'nombre' | 'descripcion' | 'precio' | 'imageUrl'>>;

export const useCatalogStore = defineStore('catalog', {
	state: (): CatalogState => ({
		rubros: [],
		productos: [],
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

		// ── Meta (redes sociales) por rubro ──
		/** Estado de Meta del rubro: app configurada + conexión. */
		async fetchMetaState(rubroId: string): Promise<MetaRubroState> {
			const { data } = await api.get<MetaRubroState>(`/rubros/${rubroId}/meta`);
			return data;
		},

		/** Carga/actualiza el App ID + App Secret de la app de Meta del rubro. */
		async saveMetaApp(rubroId: string, appId: string, appSecret: string): Promise<MetaRubroState> {
			const { data } = await api.put<MetaRubroState>(`/rubros/${rubroId}/meta/app`, { appId, appSecret });
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
	},
});
