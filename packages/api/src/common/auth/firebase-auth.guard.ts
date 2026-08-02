import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { IMPERSONATE_HEADER, Role } from '@base-template/shared';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../../modules/users/users.service';

/**
 * Verifica el Bearer ID token de Firebase, carga el perfil del usuario
 * (con su rol) desde la base, y lo adjunta a `request.user`.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
	constructor(
		private readonly firebase: FirebaseService,
		private readonly users: UsersService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const header: string | undefined = request.headers?.authorization;

		if (!header || !header.startsWith('Bearer ')) {
			throw new UnauthorizedException('Falta el token de autenticación');
		}

		const idToken = header.slice('Bearer '.length).trim();

		let decoded;
		try {
			decoded = await this.firebase.verifyIdToken(idToken);
		} catch {
			throw new UnauthorizedException('Token inválido o expirado');
		}

		const profile = await this.users.findByUid(decoded.uid);
		if (!profile || !profile.active) {
			throw new UnauthorizedException('Usuario no habilitado');
		}

		const base = {
			uid: profile.uid,
			email: profile.email,
			role: profile.role,
			espacioId: profile.espacioId,
		};

		// Impersonación: si un SUPERADMIN manda el header, cambiamos el scope de la
		// request a ese espacio con rol efectivo ADMIN. Así los endpoints del admin
		// (que filtran por espacioId y exigen rol ADMIN) trabajan sobre el cliente
		// elegido, sin tocar cada controller. Nunca aplica a rutas /auth/ (para no
		// perder la identidad real) ni a usuarios que no sean SUPERADMIN.
		const impersonateId = request.headers?.[IMPERSONATE_HEADER];
		const path: string = request.path || request.url || '';
		if (
			profile.role === Role.SUPERADMIN &&
			typeof impersonateId === 'string' &&
			impersonateId.trim() &&
			!path.includes('/auth/')
		) {
			request.user = {
				...base,
				role: Role.ADMIN,
				espacioId: impersonateId.trim(),
				impersonating: true,
				realUid: profile.uid,
				realRole: Role.SUPERADMIN,
			};
		} else {
			request.user = base;
		}

		return true;
	}
}
