-- ============================================================
--  Athlix (PRODUCCIÓN) — capturas de las 2 experiencias como "productos",
--  agrupadas en pestañas por sección: "admin" (dueño del gym) y "usuario" (socio).
--  Requiere que el rubro "Athlix" ya exista en Melolix (lo crea el seed de Melolix).
--  Idempotente: si Athlix ya tiene capturas cargadas, no inserta nada.
--
--  Imágenes: archivos estáticos del frontend (/screenshots/athlix/...),
--  ya desplegados con el build. El createdAt escalonado ordena las capturas
--  (la vitrina ordena por createdAt DESC → "Panel del dueño" primero, y la
--  pestaña Admin queda antes que Usuario).
-- ============================================================
BEGIN;

INSERT INTO productos ("rubroId", nombre, descripcion, "imageUrl", seccion, "createdAt")
SELECT a.id, c.nombre, c.descripcion, c.img, c.seccion, now() - (c.ord * interval '1 second')
FROM (
  SELECT r.id
  FROM rubros r
  JOIN espacios e ON e.id = r."espacioId"
  WHERE e.slug = 'melolix' AND lower(r.nombre) = 'athlix'
) AS a
CROSS JOIN (VALUES
  -- ── Experiencia ADMIN (dueño del gimnasio) ──
  (0, 'Panel del dueño',
      'Tu gimnasio de un vistazo: clientes activos, membresías por vencer y el estado del día en una sola pantalla.',
      '/screenshots/athlix/admin-inicio.png', 'admin'),
  (1, 'Tus clientes',
      'Todos tus socios en un lugar, con su estado al día. Buscá, sumá clientes y entrá a su ficha en segundos.',
      '/screenshots/athlix/admin-clientes.png', 'admin'),
  (2, 'Membresías',
      'Controlá cada membresía: tipo, inicio, vencimiento y pago. Filtrá por activas, por vencer, vencidas o con deuda.',
      '/screenshots/athlix/admin-membresias.png', 'admin'),
  (3, 'Rutinas y planes',
      'Armá el entrenamiento de cada cliente: rutinas de gimnasio con series y peso, o planes de running por intervalos.',
      '/screenshots/athlix/admin-rutinas.png', 'admin'),
  (4, 'Biblioteca de ejercicios',
      'Más de 60 ejercicios por músculo y equipo, filtrables por categoría, para armar rutinas más rápido. Sumá los tuyos.',
      '/screenshots/athlix/admin-ejercicios.png', 'admin'),
  (5, 'Contabilidad clara',
      'La plata del gimnasio sin planillas: ingresos del mes, total cobrado, deuda pendiente y la evolución mes a mes.',
      '/screenshots/athlix/admin-contabilidad.png', 'admin'),
  -- ── Experiencia USUARIO (el socio / atleta) ──
  (6, 'Mi entrenamiento',
      'Tu día arranca acá: elegí la disciplina, mirá tu próxima medalla y salí a entrenar de una.',
      '/screenshots/athlix/user-inicio.png', 'usuario'),
  (7, 'Salí a correr',
      'Registrá cada corrida y mirá tu historial: distancia, tiempo y ritmo de cada entrenamiento.',
      '/screenshots/athlix/user-correr.png', 'usuario'),
  (8, 'Tu progreso',
      'Seguí tu evolución: meta semanal, récords por distancia, medallas y comparás semana a semana.',
      '/screenshots/athlix/user-progreso.png', 'usuario'),
  (9, 'Tu perfil',
      'Tus datos, tus medallas y tus objetivos, siempre a mano.',
      '/screenshots/athlix/user-perfil.png', 'usuario')
) AS c(ord, nombre, descripcion, img, seccion)
WHERE NOT EXISTS (SELECT 1 FROM productos p WHERE p."rubroId" = a.id);

COMMIT;

-- Verificación
SELECT p.seccion, p.nombre, p."imageUrl"
FROM productos p
JOIN rubros r ON r.id = p."rubroId"
JOIN espacios e ON e.id = r."espacioId"
WHERE e.slug = 'melolix' AND lower(r.nombre) = 'athlix'
ORDER BY p."createdAt" DESC;
