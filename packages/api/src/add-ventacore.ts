import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppPlatform, RubroStatus } from '@base-template/shared';
import { AppModule } from './app.module';
import { EspaciosService } from './modules/spaces/espacios.service';
import { RubrosService } from './modules/catalog/rubros.service';
import { ProductosService } from './modules/catalog/productos.service';

/**
 * Agrega la app "VentaCore" (esta misma app) como rubro dentro del espacio
 * "Melolix" (tipo apps), con sus capturas de pantalla como "productos".
 *
 * - NO recrea ni toca Melolix ni sus otros rubros.
 * - Idempotente: si el rubro "VentaCore" ya existe en Melolix, lo borra y lo
 *   vuelve a crear (para poder re-correr el script sin duplicar).
 * - Las imágenes son archivos estáticos del frontend (public/screenshots/...),
 *   así que persisten y viajan a producción (no dependen del Storage efímero).
 *
 * Uso: npm run add:ventacore  (desde packages/api)
 */

const ESPACIO_NOMBRE = 'Melolix';
const RUBRO_NOMBRE = 'VentaCore';
const shot = (file: string) => `/screenshots/ventacore/${file}`;

const RUBRO = {
	nombre: RUBRO_NOMBRE,
	descripcion:
		'La plataforma que le da a cada comercio su tienda online lista para vender por redes: catálogo por rubros, ' +
		'página institucional editable y publicación en Instagram/Facebook desde un panel simple. Multi-negocio y multi-rubro.',
	imageUrl: shot('cover.png'),
	// App web/escritorio (todavía sin apps nativas ni URL pública): solo íconos, sin descargas.
	platforms: [AppPlatform.WEB, AppPlatform.DESKTOP],
	androidUrl: null as string | null,
	iosUrl: null as string | null,
	webUrl: null as string | null,
	status: RubroStatus.ACTIVE,
};

/** Cada "producto" es una captura de una pantalla de la app, con su descripción. */
const CAPTURAS = [
	{
		nombre: 'Vitrina pública',
		descripcion:
			'La tienda online de cada negocio: sus rubros en una grilla moderna tipo bento, con logo y portada, accesible desde su propio dominio.',
		imageUrl: shot('vitrina-home.png'),
	},
	{
		nombre: 'Catálogo de productos',
		descripcion:
			'Dentro de cada rubro, los productos con foto, precio, buscador y orden. El cliente consulta por WhatsApp con un solo toque.',
		imageUrl: shot('vitrina-rubro.png'),
	},
	{
		nombre: 'Página "Sobre Nosotros"',
		descripcion:
			'Una sección institucional a medida: la historia del negocio, su imagen y el acceso directo a su Instagram.',
		imageUrl: shot('sobre-nosotros.png'),
	},
	{
		nombre: 'Panel de administración',
		descripcion:
			'Cada comercio gestiona sus rubros: crea sectores, define su marca (logo y portada) y controla qué se publica y qué queda en borrador.',
		imageUrl: shot('admin-rubros.png'),
	},
	{
		nombre: 'Gestión de productos',
		descripcion:
			'Alta y edición de productos con imagen, descripción y precio, organizados por rubro, en segundos.',
		imageUrl: shot('admin-productos.png'),
	},
	{
		nombre: 'Publicación en Instagram y Facebook',
		descripcion:
			'Conectá la cuenta de Meta del negocio y publicá tus productos en redes directamente desde el panel, sin salir de la app.',
		imageUrl: shot('publicar-redes.png'),
	},
	{
		nombre: 'Editor de tu página',
		descripcion:
			'Editá tu historia con un editor visual y actualizá tus datos de contacto; los cambios se reflejan al instante en la vitrina.',
		imageUrl: shot('admin-nosotros.png'),
	},
];

async function run() {
	const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
	const espaciosSvc = app.get(EspaciosService);
	const rubrosSvc = app.get(RubrosService);
	const productosSvc = app.get(ProductosService);

	// 1) Buscar el espacio Melolix (sin recrearlo).
	const espacios = await espaciosSvc.findAllWithMeta();
	const melolix = espacios.find(e => e.nombre.toLowerCase() === ESPACIO_NOMBRE.toLowerCase());
	if (!melolix) {
		// eslint-disable-next-line no-console
		console.error(
			`✗ No encontré el espacio "${ESPACIO_NOMBRE}". Espacios disponibles: ${espacios.map(e => e.nombre).join(', ')}`,
		);
		await app.close();
		process.exit(1);
	}
	// eslint-disable-next-line no-console
	console.log(`✓ Espacio encontrado: ${melolix.nombre} (${melolix.id})`);

	// 2) Si el rubro VentaCore ya existe en Melolix, lo borramos (idempotencia).
	const rubros = await rubrosSvc.findByEspacio(melolix.id);
	const previo = rubros.find(r => r.nombre.toLowerCase() === RUBRO_NOMBRE.toLowerCase());
	if (previo) {
		await rubrosSvc.remove(previo.id, melolix.id);
		// eslint-disable-next-line no-console
		console.log(`↻ Rubro "${RUBRO_NOMBRE}" previo eliminado para recrearlo limpio.`);
	}

	// 3) Crear el rubro VentaCore.
	const rubro = await rubrosSvc.create(melolix.id, {
		nombre: RUBRO.nombre,
		descripcion: RUBRO.descripcion,
		imageUrl: RUBRO.imageUrl,
		platforms: RUBRO.platforms,
		androidUrl: RUBRO.androidUrl ?? undefined,
		iosUrl: RUBRO.iosUrl ?? undefined,
		webUrl: RUBRO.webUrl ?? undefined,
		status: RUBRO.status,
	});
	// eslint-disable-next-line no-console
	console.log(`✓ Rubro creado: ${rubro.nombre} (${rubro.id})`);

	// 4) Crear las capturas como productos.
	// La vitrina las ordena por más reciente primero, así que insertamos en orden
	// inverso para que se muestren en el orden narrativo de CAPTURAS (público → admin).
	for (const c of [...CAPTURAS].reverse()) {
		await productosSvc.create(rubro.id, melolix.id, {
			nombre: c.nombre,
			descripcion: c.descripcion,
			imageUrl: c.imageUrl,
		});
		// eslint-disable-next-line no-console
		console.log(`  · captura: ${c.nombre}`);
	}

	await app.close();
	// eslint-disable-next-line no-console
	console.log(`\n✅ Listo: "${RUBRO_NOMBRE}" agregado a "${ESPACIO_NOMBRE}" con ${CAPTURAS.length} capturas.`);
	process.exit(0);
}

run().catch(e => {
	// eslint-disable-next-line no-console
	console.error('ERROR en add-ventacore:', e);
	process.exit(1);
});
