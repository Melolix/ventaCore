import { defineStore } from 'pinia';
import type { Espacio, EspacioType } from '@base-template/shared';
import { api } from '@/shared/services/api';
import { deleteImage } from '@/shared/utils/image';

interface SpacesState {
	espacios: Espacio[];
}

export interface CreateEspacioInput {
	nombre: string;
	type?: EspacioType;
	descripcion?: string;
	logoUrl?: string;
	domain?: string;
	adminEmail: string;
	adminPassword: string;
}

export type UpdateEspacioInput = Partial<Pick<Espacio, 'nombre' | 'type' | 'descripcion' | 'logoUrl' | 'domain' | 'active'>>;

export const useSpacesStore = defineStore('spaces', {
	state: (): SpacesState => ({
		espacios: [],
	}),

	getters: {
		activos: (state): number => state.espacios.filter(e => e.active).length,
	},

	actions: {
		async fetchEspacios(): Promise<void> {
			const { data } = await api.get<Espacio[]>('/espacios');
			this.espacios = data;
		},

		async createEspacio(input: CreateEspacioInput): Promise<Espacio> {
			const { data } = await api.post<Espacio>('/espacios', input);
			this.espacios.unshift(data);
			return data;
		},

		async updateEspacio(id: string, input: UpdateEspacioInput): Promise<Espacio> {
			const prev = this.espacios.find(e => e.id === id);
			const { data } = await api.patch<Espacio>(`/espacios/${id}`, input);
			const i = this.espacios.findIndex(e => e.id === id);
			if (i !== -1) this.espacios[i] = data;
			if (prev && prev.logoUrl !== data.logoUrl) void deleteImage(prev.logoUrl);
			return data;
		},

		async deleteEspacio(id: string): Promise<void> {
			const prev = this.espacios.find(e => e.id === id);
			await api.delete(`/espacios/${id}`);
			this.espacios = this.espacios.filter(e => e.id !== id);
			if (prev) void deleteImage(prev.logoUrl);
		},
	},
});
