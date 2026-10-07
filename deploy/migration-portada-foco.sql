-- ============================================================
--  Migración: punto de foco de la portada del rubro
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  Agrega rubros."imageFocus" ("x% y%", CSS object-position): la portada se
--  sube en 3:1 y en el celu se muestra casi cuadrada; el recorte se centra en
--  este punto. NULL = centro (lo mismo que antes).
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Si el deploy corre con
--  DB_SYNCHRONIZE=true, TypeORM ya la crea solo y esto no hace nada; este
--  archivo es el respaldo para cuando synchronize esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "imageFocus" character varying;

COMMIT;
