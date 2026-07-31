import type { RouteRecordRaw } from 'vue-router';
import AdminLayout from '@/modules/admin/components/AdminLayout.vue';

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
				path: 'rubros/:id/productos',
				name: 'admin-rubro-productos',
				component: () => import('./views/ProductosView.vue'),
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
