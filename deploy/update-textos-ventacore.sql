-- ============================================================
--  Actualiza los textos de VentaCore (rubro + capturas) en Melolix.
--  Correr en la base de PRODUCCIÓN (ya sembrada con el copy anterior).
--  Idempotente: se puede re-correr sin problema.
-- ============================================================
BEGIN;

-- Descripción del rubro VentaCore
UPDATE rubros r
SET descripcion = 'Tu tienda online lista para vender por redes: catálogo por rubros, página institucional editable y publicación en Instagram y Facebook desde un panel simple. Multi-negocio y multi-rubro.'
FROM espacios e
WHERE e.id = r."espacioId" AND e.slug = 'melolix' AND lower(r.nombre) = 'ventacore';

-- Descripciones de las capturas (se emparejan por nombre)
UPDATE productos p
SET descripcion = t.descripcion
FROM (VALUES
  ('Vitrina pública',                     'Tu tienda con identidad propia: rubros en una grilla moderna, logo, portada y tu propio dominio.'),
  ('Catálogo de productos',               'Cada rubro con sus productos —foto, precio, buscador y orden—. El cliente consulta por WhatsApp con un toque.'),
  ('Página "Sobre Nosotros"',             'Contá tu historia: una página institucional con tu imagen y acceso directo a tu Instagram.'),
  ('Panel de administración',             'Gestioná tus rubros: definí tu marca (logo y portada) y controlá qué publicás y qué queda en borrador.'),
  ('Gestión de productos',                'Cargá y editá productos —imagen, descripción y precio— por rubro, en segundos.'),
  ('Publicación en Instagram y Facebook', 'Conectá tu cuenta de Meta y publicá en Instagram y Facebook directo desde el panel, sin salir de la app.'),
  ('Editor de tu página',                 'Editá tu historia con un editor visual y actualizá tus datos de contacto; se refleja al instante en la vitrina.')
) AS t(nombre, descripcion)
JOIN rubros r ON lower(r.nombre) = 'ventacore'
JOIN espacios e ON e.id = r."espacioId" AND e.slug = 'melolix'
WHERE p."rubroId" = r.id AND p.nombre = t.nombre;

COMMIT;

-- Verificación
SELECT p.nombre, p.descripcion
FROM productos p
JOIN rubros r ON r.id = p."rubroId"
JOIN espacios e ON e.id = r."espacioId"
WHERE e.slug = 'melolix' AND lower(r.nombre) = 'ventacore'
ORDER BY p."createdAt" DESC;
