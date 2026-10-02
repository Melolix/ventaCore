-- ============================================================
--  Migración: destino de los pedidos de la tienda, por rubro
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  rubros."pedidosDestino": 'cm' (WhatsApp general del espacio) o 'negocio'
--  (WhatsApp propio del rubro). rubros."whatsapp": el número propio del rubro.
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Con DB_SYNCHRONIZE=true
--  TypeORM ya las crea solo; este archivo es el respaldo para cuando esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "pedidosDestino" character varying NOT NULL DEFAULT 'cm';
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "whatsapp" character varying;

COMMIT;
