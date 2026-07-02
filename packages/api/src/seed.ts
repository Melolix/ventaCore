import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role, isRole } from '@base-template/shared';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';

/**
 * Crea un usuario con un rol dado (resuelve el huevo-y-la-gallina: el alta de
 * usuarios requiere un superadmin, pero al inicio no hay ninguno).
 *
 * Uso (desde packages/api):
 *   dotenvx run -f ../../.env.development -- ts-node -r tsconfig-paths/register src/seed.ts <email> <password> [role]
 *
 * `role` por defecto es "superadmin". Ej: ... src/seed.ts admin@x.com clave123 admin
 */
async function seed() {
	const email = process.argv[2];
	const password = process.argv[3];
	const roleArg = process.argv[4];

	if (!email || !password) {
		// eslint-disable-next-line no-console
		console.error('Uso: ts-node src/seed.ts <email> <password> [role]');
		process.exit(1);
	}

	if (roleArg && !isRole(roleArg)) {
		// eslint-disable-next-line no-console
		console.error(`Rol inválido: "${roleArg}". Usá uno de: superadmin, admin, user.`);
		process.exit(1);
	}

	const role = (roleArg as Role) ?? Role.SUPERADMIN;

	const app = await NestFactory.createApplicationContext(AppModule);
	const users = app.get(UsersService);

	const existing = await users.findByEmail(email);
	if (existing) {
		// eslint-disable-next-line no-console
		console.log(`El usuario ${email} ya existe.`);
	} else {
		await users.create({ email, password, role, displayName: email.split('@')[0] });
		// eslint-disable-next-line no-console
		console.log(`✅ Usuario creado: ${email} (rol: ${role})`);
	}

	await app.close();
	process.exit(0);
}

seed();
