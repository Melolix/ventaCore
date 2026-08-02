import type { RouteRecordRaw } from 'vue-router';
import PublicLayout from '@/modules/app/components/PublicLayout.vue';

const appRoutes: RouteRecordRaw[] = [
	{
		// El negocio se resuelve por el dominio (hostname). La raíz es su vitrina.
		path: '/',
		component: PublicLayout,
		meta: { area: 'app' },
		children: [
			{
				path: '',
				name: 'app-home',
				component: () => import('./views/Home.vue'),
			},
			{
				path: 'rubros/:id',
				name: 'app-rubro-detalle',
				component: () => import('./views/RubroDetailView.vue'),
			},
			{
				path: 'nosotros',
				name: 'app-nosotros',
				component: () => import('./views/AboutView.vue'),
			},
			{
				path: 'suscripciones',
				name: 'app-suscripciones',
				component: () => import('./views/SuscripcionesView.vue'),
			},
			{
				path: 'suscripciones/gracias',
				name: 'app-suscripciones-gracias',
				component: () => import('./views/SuscripcionesGraciasView.vue'),
			},
		],
	},
];

export default appRoutes;
