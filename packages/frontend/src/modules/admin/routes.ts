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
		],
	},
];

export default adminRoutes;
