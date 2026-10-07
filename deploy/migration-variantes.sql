-- ============================================================
--  Migración: variantes de producto (talles, colores…)
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  productos."grupo": los productos de un rubro con el mismo grupo son el mismo
--  artículo en distintas variantes; la vitrina los muestra en una sola card.
--  productos."variante": qué variante es ("M", "Azul / L").
--  Se completan al volver a bajar las publicaciones de Mercado Libre.
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Con DB_SYNCHRONIZE=true
--  TypeORM ya las crea solo; este archivo es el respaldo para cuando esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS "grupo" character varying;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS "variante" character varying;

COMMIT;
