-- ============================================================
--  Athlix (PRODUCCIÓN) — capturas de las 3 experiencias como "productos",
--  agrupadas en pestañas por sección: "dueño", "entrenador" y "socio".
--  Requiere que el rubro "Athlix" ya exista en Melolix (lo crea el seed de Melolix).
--  Idempotente: si Athlix ya tiene capturas cargadas, no inserta nada.
--    (Si cargaste una versión anterior, borralas primero: ver el DELETE comentado.)
--
--  Imágenes: archivos estáticos del frontend (/screenshots/athlix/...),
--  ya desplegados con el build. El createdAt escalonado ordena las capturas y
--  las pestañas (la vitrina ordena por createdAt DESC → Dueño / Entrenador / Socio).
-- ============================================================
BEGIN;

-- Para recargar desde cero, descomentá este DELETE:
-- DELETE FROM productos p USING rubros r, espacios e
--  WHERE p."rubroId" = r.id AND r."espacioId" = e.id AND e.slug = 'melolix' AND lower(r.nombre) = 'athlix';

INSERT INTO productos ("rubroId", nombre, descripcion, "imageUrl", seccion, "createdAt")
SELECT a.id, c.nombre, c.descripcion, c.img, c.seccion, now() - (c.ord * interval '1 second')
FROM (
  SELECT r.id
  FROM rubros r
  JOIN espacios e ON e.id = r."espacioId"
  WHERE e.slug = 'melolix' AND lower(r.nombre) = 'athlix'
) AS a
CROSS JOIN (VALUES
  -- ── DUEÑO (admin del gimnasio) ──
  (0, 'Panel del dueño',
      'Tu gimnasio de un vistazo: clientes activos, membresías por vencer, distribución por entrenador y uso de equipamiento, en una sola pantalla.',
      '/screenshots/athlix/admin-inicio.png', 'dueño'),
  (1, 'Tus socios',
      'Todos tus clientes en un lugar, con su estado al día. Buscá, sumá socios y entrá a su ficha en segundos.',
      '/screenshots/athlix/admin-clientes.png', 'dueño'),
  (2, 'Membresías',
      'Controlá cada membresía: tipo, inicio, vencimiento y pago. Filtrá por activas, por vencer, vencidas o con deuda.',
      '/screenshots/athlix/admin-membresias.png', 'dueño'),
  (3, 'Rutinas de gimnasio',
      'Constructor por día con arrastrar y soltar: sumá ejercicios con series y peso, y asignáselo al cliente.',
      '/screenshots/athlix/admin-rutina-gym.png', 'dueño'),
  (4, 'Planes de running',
      'Armá planes por semanas, días y bloques de intervalos por tiempo o distancia, con objetivo y activación automática.',
      '/screenshots/athlix/admin-plan-running.png', 'dueño'),
  (5, 'Tus entrenadores',
      'Gestioná tu equipo y asigná cada cliente a su coach, con estadísticas de carga por entrenador.',
      '/screenshots/athlix/admin-entrenadores.png', 'dueño'),
  (6, 'Contabilidad clara',
      'La plata del gimnasio sin planillas: ingresos del mes, total cobrado, deuda pendiente y la evolución mes a mes.',
      '/screenshots/athlix/admin-contabilidad.png', 'dueño'),
  -- ── ENTRENADOR ──
  (7, 'Panel del entrenador',
      'El día del coach: sus clientes activos, rutinas en curso, ingresos y un tip para mejorar el seguimiento.',
      '/screenshots/athlix/entrenador-inicio.png', 'entrenador'),
  (8, 'Sus clientes',
      'El entrenador ve solo sus asignados, con objetivos y días restantes, para hacer foco donde importa.',
      '/screenshots/athlix/entrenador-clientes.png', 'entrenador'),
  (9, 'Biblioteca de ejercicios',
      'Más de 60 ejercicios por músculo y equipo, filtrables por categoría, para armar rutinas más rápido.',
      '/screenshots/athlix/entrenador-ejercicios.png', 'entrenador'),
  -- ── SOCIO (el atleta) ──
  (10, 'Salí a correr',
      'Tus socios registran cada corrida y ven su historial: distancia, tiempo y ritmo de cada entrenamiento.',
      '/screenshots/athlix/socio-correr.png', 'socio'),
  (11, 'Su progreso',
      'Meta semanal, récords por distancia, medallas y comparación semana a semana. Motivación que engancha.',
      '/screenshots/athlix/socio-progreso.png', 'socio'),
  (12, 'Su perfil',
      'Sus datos, sus medallas y sus objetivos, siempre a mano.',
      '/screenshots/athlix/socio-perfil.png', 'socio')
) AS c(ord, nombre, descripcion, img, seccion)
WHERE NOT EXISTS (SELECT 1 FROM productos p WHERE p."rubroId" = a.id);

COMMIT;

-- Verificación
SELECT p.seccion, p.nombre
FROM productos p
JOIN rubros r ON r.id = p."rubroId"
JOIN espacios e ON e.id = r."espacioId"
WHERE e.slug = 'melolix' AND lower(r.nombre) = 'athlix'
ORDER BY p."createdAt" DESC;
