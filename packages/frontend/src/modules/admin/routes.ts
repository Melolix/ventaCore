import type { NavigationGuard, RouteRecordRaw } from 'vue-router';
import { channelEnabled, type EspacioChannel } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import AdminLayout from '@/modules/admin/components/AdminLayout.vue';

/** Bloquea la ruta si el espacio no tiene ese canal habilitado (redirige a Rubros). */
function requireChannel(channel: EspacioChannel): NavigationGuard {
	return async (_to, _from, next) => {
		const catalog = useCatalogStore();
		if (!catalog.miEspacio) await catalog.fetchMiEspacio().catch(() => undefined);
		if (channelEnabled(catalog.miEspacio, channel)) next();
		else next({ name: 'admin-rubros' });
	};
}

const adminRoutes: RouteRecordRaw[] = [
	{
		path: '/admin',
		component: AdminLayout,
		meta: { requiresAuth: true, area: 'admin' },
		children: [
			{
				path: '',
				name: 'admin-rubros',
				component: () => import('./views/RubrosView.vue'),
			},
			{
				path: 'cargar-productos',
				name: 'admin-carga-masiva',
				component: () => import('./views/CargaMasivaView.vue'),
			},
			{
				path: 'mercado-libre',
				component: () => import('./views/MercadoLibreLayout.vue'),
				beforeEnter: requireChannel('mercadolibre'),
				children: [
					// La ruta base redirige a Publicaciones (el nombre histórico se mantiene).
					{ path: '', name: 'admin-mercado-libre', redirect: { name: 'admin-ml-publicaciones' } },
					{
						path: 'publicaciones',
						name: 'admin-ml-publicaciones',
						component: () => import('./views/MercadoLibreView.vue'),
					},
					{
						path: 'ventas',
						name: 'admin-ml-ventas',
						component: () => import('./views/VentasView.vue'),
					},
				],
			},
			{
				path: 'instagram',
				name: 'admin-instagram',
				component: () => import('./views/InstagramView.vue'),
				beforeEnter: requireChannel('instagram'),
			},
			{
				path: 'configuraciones',
				name: 'admin-configuraciones',
				component: () => import('./views/ConfiguracionesView.vue'),
			},
			{
				path: 'rubros/:id/planes',
				name: 'admin-rubro-planes',
				component: () => import('./views/SubscripcionesView.vue'),
			},
			{
				path: 'cobros',
				name: 'admin-cobros',
				component: () => import('./views/CobrosView.vue'),
			},
			{
				path: 'nosotros',
				name: 'admin-nosotros',
				component: () => import('./views/MiPaginaView.vue'),
			},
		],
	},
];

export default adminRoutes;
