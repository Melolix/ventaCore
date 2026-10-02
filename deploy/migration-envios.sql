-- ============================================================
--  Migración: envíos de la tienda (envia.com)
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--  Requiere haber corrido antes migration-pedidos.sql (tabla pedidos).
--
--  rubros: dirección de despacho, paquete por defecto y cuenta propia de envia.
--  pedidos: dirección estructurada, opción de envío elegida y su costo.
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Con DB_SYNCHRONIZE=true
--  TypeORM ya lo crea solo; este archivo es el respaldo para cuando esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "despacho" jsonb;
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "paqueteDefault" jsonb;
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "enviaToken" character varying;
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "enviaPropia" boolean NOT NULL DEFAULT false;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "destino" jsonb;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "envio" jsonb;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "envioCosto" numeric(14,2) NOT NULL DEFAULT 0;

COMMIT;

-- Etapa 2: bulto cotizado y envío generado (seguimiento + etiqueta).
BEGIN;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "paquete" jsonb;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS "etiqueta" jsonb;
COMMIT;
