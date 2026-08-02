import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { AREAS, areaForRole, Role, type AreaKey } from '@base-template/shared';
import { useUserStore } from '@/modules/auth/store/user';
import { useImpersonation } from '@/modules/superadmin/store/impersonation';
import LoginForm from '@/modules/auth/components/LoginForm.vue';

import superadminRoutes from '@/modules/superadmin/routes';
import adminRoutes from '@/modules/admin/routes';
import appRoutes from '@/modules/app/routes';

declare module 'vue-router' {
	interface RouteMeta {
		/** Área a la que pertenece la ruta (superadmin | admin | app) */
		area?: AreaKey;
		/** Requiere usuario autenticado con el rol del área */
		requiresAuth?: boolean;
		/** Solo accesible sin sesión (pantallas de login) */
		guestOnly?: boolean;
	}
}

const routes: RouteRecordRaw[] = [
	// Login único: un solo formulario que redirige según el rol del usuario.
	{
		path: '/login',
		name: 'login',
		component: LoginForm,
		meta: { guestOnly: true },
	},

	...superadminRoutes,
	...adminRoutes,
	// appRoutes define la raíz '/' (vitrina pública del negocio del dominio).
	...appRoutes,

	{
		path: '/:pathMatch(.*)*',
		name: 'notfound',
		component: () => import('@/shared/views/NotFound.vue'),
	},
];

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});

router.beforeEach(async to => {
	const userStore = useUserStore();
	const impersonation = useImpersonation();
	const area = to.meta.area ? AREAS[to.meta.area] : null;

	// Al entrar al área de superadmin dejamos de "ver como" un cliente: el header
	// de impersonación rompería los endpoints de superadmin (piden rol SUPERADMIN).
	if (area?.key === 'superadmin') impersonation.exit();

	// Pantallas de login: si ya hay sesión, mandar a su área correspondiente.
	if (to.meta.guestOnly) {
		const user = await userStore.currentUser();
		if (user) {
			return { path: areaForRole(user.role).homePath };
		}
		return true;
	}

	// Rutas protegidas.
	if (to.meta.requiresAuth && area) {
		const user = await userStore.currentUser();

		// Sin sesión → al login único, recordando el destino.
		if (!user) {
			return { path: '/login', query: { redirect: to.fullPath } };
		}

		// Rol distinto al del área → a SU propia área. Excepción: un SUPERADMIN
		// "viendo como" un cliente puede entrar al área admin.
		if (user.role !== area.role) {
			const enteringAsClient = area.key === 'admin' && user.role === Role.SUPERADMIN && impersonation.active;
			if (!enteringAsClient) {
				return { path: areaForRole(user.role).homePath };
			}
		}
	}

	return true;
});

export default router;
