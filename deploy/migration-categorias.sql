-- ============================================================
--  Migración: categorías del catálogo (menú de la tienda)
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  Agrega rubros."categorias": la lista ORDENADA de categorías del rubro (el
--  orden del menú en la tienda). Cada producto apunta a una por nombre en
--  productos."seccion" (columna que ya existía).
--
--  Idempotente: IF NOT EXISTS → re-correrla es segura. Si el deploy corre con
--  DB_SYNCHRONIZE=true, TypeORM ya la crea solo y esto no hace nada; este
--  archivo es el respaldo para cuando synchronize esté apagado.
-- ============================================================
BEGIN;

ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "categorias" jsonb NOT NULL DEFAULT '[]';

COMMIT;
