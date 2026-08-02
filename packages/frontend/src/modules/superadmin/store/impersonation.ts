import { defineStore } from 'pinia';

/**
 * "Ver como": un superadmin entra al panel de un cliente sin usar su cuenta.
 * Mientras esté activo, el interceptor de la API manda el header de impersonación
 * y el backend scopea todo a ese espacio. Se persiste para sobrevivir recargas
 * dentro del panel del cliente; se limpia al "Salir", al cerrar sesión y al
 * volver al área de superadmin.
 */
export const useImpersonation = defineStore('impersonation', {
	state: () => ({
		/** Id del espacio (cliente) que se está viendo. '' = no impersonando. */
		espacioId: '' as string,
		/** Nombre del cliente, para el banner. */
		espacioNombre: '' as string,
	}),
	getters: {
		active: (state): boolean => !!state.espacioId,
	},
	actions: {
		enter(id: string, nombre: string): void {
			this.espacioId = id;
			this.espacioNombre = nombre;
		},
		exit(): void {
			this.espacioId = '';
			this.espacioNombre = '';
		},
	},
	persist: true,
});
