-- ============================================================
--  Migración: venta por kilo (verdulerías y similares)
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  productos."unidadVenta": 'unidad' (cantidades enteras, lo de siempre) | 'kg'
--  (el precio es el del kilo y el cliente pide con decimales: 0,5 / 1,25 kg…).
--  productos."incremento": por kilo, de a cuántos kg se pide (también es el
--  mínimo). NULL = el default (0,5 kg). Lo que va por kilo no lleva stock.
--
--  Los ítems de pedidos (jsonb) suman "unidad"; los pedidos viejos no lo
--  tienen y se leen como 'unidad', así que no hace falta tocarlos.
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Con DB_SYNCHRONIZE=true
--  TypeORM ya la crea solo; este archivo es el respaldo para cuando esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS "unidadVenta" varchar NOT NULL DEFAULT 'unidad';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS "incremento" numeric(6,3);

COMMIT;
