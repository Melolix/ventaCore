import { defineStore } from 'pinia';
import type { Rubro, Producto } from '@base-template/shared';
import { api } from '@/shared/services/api';

interface CatalogState {
	rubros: Rubro[];
	productos: Producto[];
	// Escaparate público
	publicRubros: Rubro[];
	currentRubro: Rubro | null;
	publicProductos: Producto[];
}

/** Payloads de creación/edición (el backend infiere el dueño desde el token). */
export type RubroInput = Partial<Pick<Rubro, 'nombre' | 'descripcion' | 'imageUrl' | 'status'>>;
export type ProductoInput = Partial<Pick<Producto, 'nombre' | 'descripcion' | 'precio' | 'imageUrl'>>;

export const useCatalogStore = defineStore('catalog', {
	state: (): CatalogState => ({
		rubros: [],
		productos: [],
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
			const { data } = await api.patch<Rubro>(`/rubros/${id}`, input);
			const i = this.rubros.findIndex(r => r.id === id);
			if (i !== -1) this.rubros[i] = data;
			return data;
		},

		async deleteRubro(id: string): Promise<void> {
			await api.delete(`/rubros/${id}`);
			this.rubros = this.rubros.filter(r => r.id !== id);
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
			const { data } = await api.patch<Producto>(`/rubros/${rubroId}/productos/${id}`, input);
			const i = this.productos.findIndex(p => p.id === id);
			if (i !== -1) this.productos[i] = data;
			return data;
		},

		async deleteProducto(rubroId: string, id: string): Promise<void> {
			await api.delete(`/rubros/${rubroId}/productos/${id}`);
			this.productos = this.productos.filter(p => p.id !== id);
		},

		// ── Público (escaparate anónimo) ──
		async fetchPublicRubros(): Promise<void> {
			const { data } = await api.get<Rubro[]>('/public/rubros');
			this.publicRubros = data;
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
