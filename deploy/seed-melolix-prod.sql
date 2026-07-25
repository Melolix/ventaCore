-- ============================================================
--  Seed Melolix (PRODUCCIÓN) — rubros Athlix + VentaCore
--  Correlo en tu DB visualizer, apuntado a la base REAL.
--
--  - Busca el espacio por slug 'melolix' (no hace falta el id).
--  - Idempotente: si el rubro ya existe (por nombre en Melolix), NO lo
--    duplica ni lo pisa (así podés re-correrlo sin miedo).
--  - VentaCore queda COMPLETO: sus 7 capturas son archivos estáticos ya
--    desplegados (/screenshots/ventacore/...).
--  - Athlix queda con texto + plataformas; la PORTADA y el APK los subís
--    a mano editando el rubro (van a Firebase Storage).
-- ============================================================
BEGIN;

-- 1) Athlix (portada y APK se cargan a mano después)
INSERT INTO rubros ("espacioId", nombre, descripcion, platforms, status)
SELECT e.id,
       'Athlix',
       'Athlix es la plataforma que conecta entrenadores y deportistas en un solo lugar. Diseñada para gimnasios, coaches personales y amantes del entrenamiento: gestioná rutinas, seguí el progreso, mirá estadísticas en tiempo real y sumá logros y medallas. Entrená, superate y evolucioná — tu mejor versión, todos los días.',
       'android,ios,web,desktop',
       'active'::rubros_status_enum
FROM espacios e
WHERE e.slug = 'melolix'
  AND NOT EXISTS (
    SELECT 1 FROM rubros r WHERE r."espacioId" = e.id AND lower(r.nombre) = 'athlix'
  );

-- 2) VentaCore + sus 7 capturas (imágenes estáticas ya desplegadas).
--    El createdAt escalonado hace que se muestren en orden (la vitrina
--    ordena por createdAt DESC → "Vitrina pública" primero).
WITH nuevo AS (
  INSERT INTO rubros ("espacioId", nombre, descripcion, "imageUrl", platforms, status)
  SELECT e.id,
         'VentaCore',
         'Tu tienda online lista para vender por redes: catálogo por rubros, página institucional editable y publicación en Instagram y Facebook desde un panel simple. Multi-negocio y multi-rubro.',
         '/screenshots/ventacore/cover.png',
         'web,desktop',
         'active'::rubros_status_enum
  FROM espacios e
  WHERE e.slug = 'melolix'
    AND NOT EXISTS (
      SELECT 1 FROM rubros r WHERE r."espacioId" = e.id AND lower(r.nombre) = 'ventacore'
    )
  RETURNING id
)
INSERT INTO productos ("rubroId", nombre, descripcion, "imageUrl", "createdAt")
SELECT nuevo.id, c.nombre, c.descripcion, c.img, now() - (c.ord * interval '1 second')
FROM nuevo
CROSS JOIN (VALUES
  (0, 'Vitrina pública',
      'Tu tienda con identidad propia: rubros en una grilla moderna, logo, portada y tu propio dominio.',
      '/screenshots/ventacore/vitrina-home.png'),
  (1, 'Catálogo de productos',
      'Cada rubro con sus productos —foto, precio, buscador y orden—. El cliente consulta por WhatsApp con un toque.',
      '/screenshots/ventacore/vitrina-rubro.png'),
  (2, 'Página "Sobre Nosotros"',
      'Contá tu historia: una página institucional con tu imagen y acceso directo a tu Instagram.',
      '/screenshots/ventacore/sobre-nosotros.png'),
  (3, 'Panel de administración',
      'Gestioná tus rubros: definí tu marca (logo y portada) y controlá qué publicás y qué queda en borrador.',
      '/screenshots/ventacore/admin-rubros.png'),
  (4, 'Gestión de productos',
      'Cargá y editá productos —imagen, descripción y precio— por rubro, en segundos.',
      '/screenshots/ventacore/admin-productos.png'),
  (5, 'Publicación en Instagram y Facebook',
      'Conectá tu cuenta de Meta y publicá en Instagram y Facebook directo desde el panel, sin salir de la app.',
      '/screenshots/ventacore/publicar-redes.png'),
  (6, 'Editor de tu página',
      'Editá tu historia con un editor visual y actualizá tus datos de contacto; se refleja al instante en la vitrina.',
      '/screenshots/ventacore/admin-nosotros.png')
) AS c(ord, nombre, descripcion, img);

COMMIT;

-- ── Verificación (opcional): rubros de Melolix y cantidad de productos ──
SELECT r.nombre, r.platforms, r.status,
       (SELECT count(*) FROM productos p WHERE p."rubroId" = r.id) AS productos
FROM rubros r
JOIN espacios e ON e.id = r."espacioId"
WHERE e.slug = 'melolix'
ORDER BY r."createdAt";
