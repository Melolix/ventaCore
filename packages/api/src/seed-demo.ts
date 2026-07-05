import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role, RubroStatus } from '@base-template/shared';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserEntity } from './modules/users/entities/user.entity';
import { FirebaseService } from './common/firebase/firebase.service';
import { EspaciosService } from './modules/spaces/espacios.service';
import { RubrosService } from './modules/catalog/rubros.service';
import { ProductosService } from './modules/catalog/productos.service';

/**
 * Siembra/repara los datos de demo. Es idempotente Y robusto ante la pérdida de
 * usuarios del emulador de Firebase (que es efímero): si un usuario ya existe en
 * Postgres pero falta en el emulador, lo recrea allí con el MISMO uid, de modo que
 * el login y `/auth/me` siguen funcionando. Se ejecuta en cada `npm run dev`.
 */

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1000&q=80`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const ESPACIOS = [
	{
		nombre: 'Campo & Ruta',
		descripcion: 'Maquinaria agrícola y vehículos para el trabajo y la familia.',
		logoUrl: img('1594771804886-a933bb2d609b'),
		adminEmail: 'admin@ventacore.com',
		adminPassword: 'admin123',
		about: {
			whatsapp: '5493511234567',
			instagramUrl: 'https://instagram.com/campo.ruta',
			aboutHeadline: 'Máquinas que trabajan tanto como vos',
			aboutImageUrl: img('1615811361523-6bd03d7748e7'),
			aboutText:
				'<p>En <strong>Campo &amp; Ruta</strong> llevamos más de <strong>20 años</strong> acercando maquinaria agrícola y vehículos a quienes hacen producir la tierra. Empezamos como un taller familiar y hoy somos referentes en la zona.</p>' +
				'<p>Trabajamos con las <strong>mejores marcas</strong> del mercado y ofrecemos <strong>financiación a medida</strong>, asesoramiento técnico y servicio de posventa. Porque sabemos que tu equipo no puede parar.</p>',
		},
		rubros: [
			{
				nombre: 'Maquinaria de Campo',
				descripcion: 'Equipos agrícolas de alta potencia para siembra, cosecha y pulverización.',
				img: '1594771804886-a933bb2d609b',
				productos: [
					{ nombre: 'Tractor 4x4 6110', descripcion: '110 HP, cabina climatizada y piloto automático.', precio: 45000000, img: '1615811361523-6bd03d7748e7' },
					{ nombre: 'Cosechadora Axial 9000', descripcion: 'Rotor axial, tolva de 900 L y mapeo GPS.', precio: 120000000, img: '1600747476236-76579658b1b1' },
					{ nombre: 'Sembradora de Precisión 48', descripcion: '48 líneas, siembra directa y dosificación electrónica.', precio: 38000000, img: '1696441567908-6a04d49e1350' },
					{ nombre: 'Pulverizadora Autopropulsada', descripcion: 'Botalón de 30 m con corte por secciones.', precio: 62000000, img: '1655130944329-b3a63166f6b5' },
					{ nombre: 'Tolva Autodescargable', descripcion: 'Capacidad 22 tn, descarga rápida a granel.', precio: 15000000, img: '1635174815612-fd9636f70146' },
				],
			},
			{
				nombre: 'Autos',
				descripcion: 'Vehículos para uso familiar, urbano y de trabajo. Financiación disponible.',
				img: '1574023240744-64c47c8c0676',
				productos: [
					{ nombre: 'Sedán Familiar 1.6', descripcion: 'Nafta, caja manual, bajo consumo y amplio baúl.', precio: 22000000, img: '1621808752171-531c30903889' },
					{ nombre: 'Hatchback Urbano', descripcion: 'Compacto, ágil y equipado para la ciudad.', precio: 18500000, img: '1574023278969-abb7ab49945c' },
					{ nombre: 'SUV Compacta', descripcion: 'Tracción integral, pantalla táctil y cámara de retroceso.', precio: 31000000, img: '1585390062628-be8608aa7d83' },
					{ nombre: 'Pick-up 4x4', descripcion: 'Doble cabina, diésel turbo y gran capacidad de carga.', precio: 42000000, img: '1551830820-330a71b99659' },
					{ nombre: 'Utilitario de Carga', descripcion: 'Furgón amplio, ideal para reparto y logística.', precio: 27000000, img: '1634981297356-f9b4daa98a92' },
				],
			},
		],
	},
	{
		nombre: 'Hogar & Tech',
		descripcion: 'Todo para tu casa y tus dispositivos: exteriores premium y tecnología.',
		logoUrl: img('1515940175183-6798529cb860'),
		adminEmail: 'admin2@ventacore.com',
		adminPassword: 'admin123',
		about: {
			whatsapp: '5491145678901',
			instagramUrl: 'https://instagram.com/hogar.tech',
			aboutHeadline: 'Tu casa y tu tecnología, en un solo lugar',
			aboutImageUrl: img('1712254293792-1013ae15fafd'),
			aboutText:
				'<p><strong>Hogar &amp; Tech</strong> nació de una idea simple: que puedas <strong>equipar tu casa y renovar tu tecnología</strong> sin dar mil vueltas. Diseño de exteriores premium y los últimos gadgets, con la misma atención de siempre.</p>' +
				'<p>Cada proyecto y cada producto pasa por nuestro <strong>control de calidad</strong>. Comprás con <strong>garantía oficial</strong> y el respaldo de un equipo que te acompaña antes y después de la compra.</p>',
		},
		rubros: [
			{
				nombre: 'Exteriores y Jardines',
				descripcion: 'Diseño y proyectos de espacios exteriores premium: jardines, decks y piletas.',
				img: '1712254293792-1013ae15fafd',
				productos: [
					{ nombre: 'Diseño de Jardín Premium', descripcion: 'Proyecto integral con especies nativas y riego automático.', precio: 3500000, img: '1782203601219-c772fac676dc' },
					{ nombre: 'Deck de Madera', descripcion: 'Madera dura tratada, instalación y sellado incluidos.', precio: 2800000, img: '1656646549633-80ad4bd2ab40' },
					{ nombre: 'Pileta de Hormigón', descripcion: '8x4 m, revestimiento premium e iluminación LED.', precio: 12000000, img: '1729866097380-88243b1d90ad' },
					{ nombre: 'Pérgola Moderna', descripcion: 'Estructura de aluminio con techo regulable.', precio: 4200000, img: '1718131341732-2c96c6d1fe4c' },
					{ nombre: 'Iluminación Exterior', descripcion: 'Kit de luces solares y balizas para senderos.', precio: 950000, img: '1777502372006-9eb6e8a07a34' },
				],
			},
			{
				nombre: 'Tecnología',
				descripcion: 'Electrónica y gadgets de última generación con garantía oficial.',
				img: '1515940175183-6798529cb860',
				productos: [
					{ nombre: 'Notebook Pro 15', descripcion: 'Pantalla 15", 16 GB RAM y SSD de 512 GB.', precio: 1350000, img: '1525547719571-a2d4ac8945e2' },
					{ nombre: 'Smartphone 5G', descripcion: 'Triple cámara, 256 GB y batería de larga duración.', precio: 890000, img: '1511707171634-5f897ff02aa9' },
					{ nombre: 'Auriculares Inalámbricos', descripcion: 'Cancelación de ruido y 30 h de autonomía.', precio: 210000, img: '1505740420928-5e560c06d30e' },
					{ nombre: 'Smart TV 55"', descripcion: '4K HDR con sistema operativo integrado.', precio: 780000, img: '1560169897-fc0cdbdfa4d5' },
					{ nombre: 'Tablet 11"', descripcion: 'Ideal para trabajo y entretenimiento, con lápiz óptico.', precio: 640000, img: '1561154464-82e9adf32764' },
				],
			},
		],
	},
];

/** Espera (best-effort) a que una URL responda; devuelve al primer intento OK. */
async function waitFor(url: string, tries = 45): Promise<void> {
	for (let i = 0; i < tries; i++) {
		try {
			await fetch(url);
			return;
		} catch {
			await sleep(1000);
		}
	}
}

/**
 * Espera al emulador (para crear usuarios) y al API (que ya hizo el `synchronize`
 * de las tablas), evitando correr el seed en paralelo al arranque del API.
 */
async function waitForServices(): Promise<void> {
	const emu = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
	const prefix = process.env.API_PREFIX || 'api';
	const port = process.env.API_PORT || '3000';
	await waitFor(`http://${emu}/`);
	await waitFor(`http://localhost:${port}/${prefix}/public/site?host=_seed_`);
}

async function seed() {
	await waitForServices();

	const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
	const users = app.get(UsersService);
	const firebase = app.get(FirebaseService);
	const espaciosSvc = app.get(EspaciosService);
	const rubrosSvc = app.get(RubrosService);
	const productosSvc = app.get(ProductosService);

	/**
	 * Garantiza que el usuario exista y sea logueable:
	 *  - si ya está en Postgres, lo recrea en el emulador con el MISMO uid;
	 *  - si no está, lo crea en Firebase + Postgres.
	 */
	async function ensureAuthUser(
		email: string,
		password: string,
		role: Role,
		displayName: string,
		espacioId: string | null = null,
	): Promise<UserEntity> {
		const existing = await users.findByEmail(email);
		if (existing) {
			try {
				await firebase.auth.createUser({ uid: existing.uid, email, password, displayName });
				// eslint-disable-next-line no-console
				console.log(`↻ auth re-sincronizado en emulador: ${email}`);
			} catch {
				// Ya está en el emulador (uid/email existentes) → nada que hacer.
			}
			return existing;
		}
		const created = await users.create({ email, password, role, displayName, espacioId: espacioId ?? undefined });
		// eslint-disable-next-line no-console
		console.log(`✅ usuario creado: ${email} (${role})`);
		return created;
	}

	// 1) Superadmin
	await ensureAuthUser('superadmin@ventacore.com', 'superadmin123', Role.SUPERADMIN, 'Super Admin');

	// 2) Espacios (negocios) con su admin, rubros y productos
	const existentes = await espaciosSvc.findAllWithMeta();
	for (const e of ESPACIOS) {
		const yaExiste = existentes.find(x => x.nombre === e.nombre);

		if (yaExiste) {
			// Datos ya presentes: re-sincronizamos el admin en el emulador y,
			// si todavía no tiene "Sobre Nosotros" cargado, lo completamos.
			await ensureAuthUser(e.adminEmail, e.adminPassword, Role.ADMIN, e.nombre, yaExiste.id);
			if (!yaExiste.aboutText) {
				await espaciosSvc.updateAbout(yaExiste.id, e.about);
				// eslint-disable-next-line no-console
				console.log(`↻ "Sobre Nosotros" completado: ${e.nombre}`);
			}
			continue;
		}

		// Espacio nuevo: se crea junto con su admin, rubros y productos.
		const espacio = await espaciosSvc.create({
			nombre: e.nombre,
			descripcion: e.descripcion,
			logoUrl: e.logoUrl,
			adminEmail: e.adminEmail,
			adminPassword: e.adminPassword,
		});
		// eslint-disable-next-line no-console
		console.log(`✅ Espacio: ${espacio.nombre} (admin: ${e.adminEmail})`);

		// Página "Sobre Nosotros" de ejemplo (contacto + historia con formato).
		await espaciosSvc.updateAbout(espacio.id, e.about);

		for (const r of e.rubros) {
			const rubro = await rubrosSvc.create(espacio.id, {
				nombre: r.nombre,
				descripcion: r.descripcion,
				imageUrl: img(r.img),
				status: RubroStatus.ACTIVE,
			});
			for (const p of r.productos) {
				await productosSvc.create(rubro.id, espacio.id, {
					nombre: p.nombre,
					descripcion: p.descripcion,
					precio: p.precio,
					imageUrl: img(p.img),
				});
			}
		}
	}

	await app.close();
	// eslint-disable-next-line no-console
	console.log('✅ Seed/sync de demo completado.');
	process.exit(0);
}

seed().catch(e => {
	// eslint-disable-next-line no-console
	console.error('ERROR en el seed de demo:', e);
	process.exit(1);
});
