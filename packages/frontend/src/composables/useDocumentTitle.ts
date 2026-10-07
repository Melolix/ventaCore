import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '@/modules/auth/store/user';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { i18n } from '@/i18n';

const BASE = 'VentaCore';
const t = (key: string) => i18n.global.t(key);

/**
 * Mantiene el `document.title` sincronizado con el contexto, para poder
 * distinguir pestañas de un vistazo:
 *
 * - Superadmin  → "Superadmin · VentaCore"
 * - Admin       → "{cliente} · Panel · VentaCore"   (p. ej. "Campo & Ruta · Panel · VentaCore")
 * - Vitrina     → "{negocio}"                        (lo que ve el cliente final)
 * - Login       → "Ingresar · VentaCore"
 *
 * Lo más distintivo va primero porque el navegador trunca el final de la pestaña.
 */
export function useDocumentTitle() {
	const route = useRoute();
	const user = useUserStore();
	const catalog = useCatalogStore();

	function compute(): string {
		if (route.meta.guestOnly) return `${t('docTitle.login')} · ${BASE}`;

		switch (route.meta.area) {
			case 'superadmin':
				return `Superadmin · ${BASE}`;
			case 'admin': {
				const cliente = user.profile?.displayName || user.profile?.email;
				return cliente ? `${cliente} · ${t('docTitle.panel')} · ${BASE}` : `${t('docTitle.panel')} · ${BASE}`;
			}
			case 'app':
				return catalog.currentEspacio?.nombre || BASE;
			default:
				return BASE;
		}
	}

	watch(
		() => [route.fullPath, user.profile?.displayName, catalog.currentEspacio?.nombre],
		() => {
			document.title = compute();
		},
		{ immediate: true },
	);
}
