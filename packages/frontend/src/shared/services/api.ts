import axios, { type AxiosInstance } from 'axios';
import { IMPERSONATE_HEADER } from '@base-template/shared';
import { auth } from '@/shared/providers/firebase';
import { useImpersonation } from '@/modules/superadmin/store/impersonation';

/**
 * Cliente HTTP base. Inyecta automáticamente el ID token de Firebase
 * en cada request. Cuando generes el SDK (@base-template/sdk) podés
 * configurarlo para usar esta misma instancia de axios.
 */
export const api: AxiosInstance = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async config => {
	const user = auth.currentUser;
	if (user) {
		const token = await user.getIdToken();
		config.headers.Authorization = `Bearer ${token}`;
	}
	// "Ver como": si un superadmin está impersonando, mandamos el header para que
	// el backend scopee al cliente. Nunca en /auth/ (ahí queremos la identidad real).
	const imp = useImpersonation();
	const url = config.url ?? '';
	if (imp.active && !url.includes('/auth/')) {
		config.headers[IMPERSONATE_HEADER] = imp.espacioId;
	}
	return config;
});
