import { defineStore } from 'pinia';

/**
 * Contexto del admin: qué negocio (rubro) está gestionando ahora. Se elige una
 * vez con el selector de arriba y todas las pantallas (cargar productos, Mercado
 * Libre, configuraciones) trabajan sobre este rubro. Se persiste para no perder
 * la elección entre recargas/navegación.
 */
export const useAdminContext = defineStore('adminContext', {
	state: () => ({
		/** Id del rubro/negocio activo. '' = ninguno elegido todavía. */
		currentRubroId: '' as string,
	}),
	actions: {
		setRubro(id: string): void {
			this.currentRubroId = id;
		},
	},
	persist: true,
});
