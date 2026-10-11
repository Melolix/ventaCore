-- ============================================================
--  Migración: características con nombre de las opciones de producto
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  productos."opciones": [{ "nombre": "Peso", "valor": "1 kg" }] (hasta 3). Es el
--  detalle de productos."variante" ("Negro / M" → Color: Negro, Talle: M): con el
--  nombre se sabe a qué atributo de Mercado Libre va cada valor y la vitrina
--  arma un selector por característica. NULL = opción sin detallar (lo anterior
--  sigue funcionando igual).
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Con DB_SYNCHRONIZE=true
--  TypeORM ya la crea solo; este archivo es el respaldo para cuando esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS "opciones" jsonb;

COMMIT;
