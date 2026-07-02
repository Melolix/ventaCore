import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role, RubroStatus } from '@base-template/shared';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserEntity } from './modules/users/entities/user.entity';
import { RubrosService } from './modules/catalog/rubros.service';
import { ProductosService } from './modules/catalog/productos.service';

/**
 * Siembra datos de demostración completos: usuarios (superadmin + admin) y un
 * catálogo de 4 rubros con 5 productos cada uno, con imágenes de Unsplash.
 *
 * Requiere el emulador de Firebase Auth y Postgres corriendo (los levanta
 * `npm run dev`). Uso (desde la raíz): `npm run seed:demo`.
 *
 * Es idempotente: si el admin ya tiene rubros, no vuelve a sembrar.
 */

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1000&q=80`;

const CATALOGO = [
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
];

async function ensureUser(
	users: UsersService,
	email: string,
	password: string,
	role: Role,
	displayName: string,
): Promise<UserEntity> {
	const existing = await users.findByEmail(email);
	if (existing) {
		// eslint-disable-next-line no-console
		console.log(`Usuario ya existe: ${email} (${existing.role})`);
		return existing;
	}
	const created = await users.create({ email, password, role, displayName });
	// eslint-disable-next-line no-console
	console.log(`✅ Usuario creado: ${email} (${role})`);
	return created;
}

async function seed() {
	const app = await NestFactory.createApplicationContext(AppModule);
	const users = app.get(UsersService);
	const rubros = app.get(RubrosService);
	const productos = app.get(ProductosService);

	// 1) Usuarios de acceso
	await ensureUser(users, 'superadmin@ventacore.com', 'superadmin123', Role.SUPERADMIN, 'Super Admin');
	const admin = await ensureUser(users, 'admin@ventacore.com', 'admin123', Role.ADMIN, 'Admin');

	// 2) Catálogo de demo (solo si el admin no tiene rubros aún)
	const existentes = await rubros.findByOwner(admin.uid);
	if (existentes.length) {
		// eslint-disable-next-line no-console
		console.log(`El admin ya tiene ${existentes.length} rubros; no se resiembra el catálogo.`);
	} else {
		for (const r of CATALOGO) {
			const rubro = await rubros.create(admin.uid, {
				nombre: r.nombre,
				descripcion: r.descripcion,
				imageUrl: img(r.img),
				status: RubroStatus.ACTIVE,
			});
			for (const p of r.productos) {
				await productos.create(rubro.id, admin.uid, {
					nombre: p.nombre,
					descripcion: p.descripcion,
					precio: p.precio,
					imageUrl: img(p.img),
				});
			}
			// eslint-disable-next-line no-console
			console.log(`✅ Rubro sembrado: ${r.nombre} (${r.productos.length} productos)`);
		}
	}

	await app.close();
	// eslint-disable-next-line no-console
	console.log('\n✅ Seed de demo completado.');
	process.exit(0);
}

seed().catch(e => {
	// eslint-disable-next-line no-console
	console.error('ERROR en el seed de demo:', e);
	process.exit(1);
});
