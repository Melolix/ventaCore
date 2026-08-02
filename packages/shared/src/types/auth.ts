import { Role } from './role';
import { UserProfile } from './user';

/**
 * Header con el que un SUPERADMIN pide "ver como" (impersonar) un espacio.
 * El backend cambia el scope de la request a ese espacio; el resto de usuarios
 * lo ignora. En minúsculas: los headers HTTP se normalizan así.
 */
export const IMPERSONATE_HEADER = 'x-impersonate-espacio';

/** Payload que el backend adjunta al request tras verificar el ID token. */
export interface AuthenticatedUser {
	uid: string;
	email: string;
	role: Role;
	/** Espacio del admin/CM (null para superadmin). */
	espacioId?: string | null;
	/** true si es un SUPERADMIN "viendo como" un espacio (impersonación). */
	impersonating?: boolean;
	/** Identidad real cuando impersona (para auditoría). */
	realUid?: string;
	realRole?: Role;
}

export interface MeResponse {
	user: UserProfile;
}
