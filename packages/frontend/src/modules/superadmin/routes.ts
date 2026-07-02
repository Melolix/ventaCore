import type { RouteRecordRaw } from 'vue-router';
import AreaLayout from '@/modules/auth/components/AreaLayout.vue';

const superadminRoutes: RouteRecordRaw[] = [
	{
		path: '/superadmin',
		component: AreaLayout,
		props: { area: 'superadmin' },
		meta: { requiresAuth: true, area: 'superadmin' },
		children: [
			{
				path: '',
				name: 'superadmin-home',
				component: () => import('./views/Dashboard.vue'),
			},
		],
	},
];

export default superadminRoutes;
