import type { RouteRecordRaw } from 'vue-router';

/**
 * Páginas legales de la plataforma (Melolix / VentaCore). Son GLOBALES: no
 * dependen del negocio del dominio, así funcionan igual en melolix.ar,
 * ventacore.melolix.ar o la vitrina de cualquier cliente. Meta las exige para
 * aprobar la app (política de privacidad, términos, eliminación de datos).
 */
const legalRoutes: RouteRecordRaw[] = [
	{
		path: '/privacidad',
		name: 'legal-privacidad',
		component: () => import('./views/PrivacidadView.vue'),
	},
	{
		path: '/terminos',
		name: 'legal-terminos',
		component: () => import('./views/TerminosView.vue'),
	},
	{
		path: '/eliminar-datos',
		name: 'legal-eliminar-datos',
		component: () => import('./views/EliminarDatosView.vue'),
	},
];

export default legalRoutes;
