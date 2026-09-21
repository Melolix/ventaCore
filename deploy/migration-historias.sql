-- ============================================================
--  Migración: Historias de Instagram en el Estudio
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  Agrega meta_posts.kind ('post' | 'story') para distinguir en el historial
--  un post del feed de una Historia (que además expira a las 24 h).
--  Idempotente: IF NOT EXISTS → re-correrla es segura.
--  Reproduce EXACTO lo que TypeORM genera en dev (varchar con default 'post').
-- ============================================================
BEGIN;

-- La tabla puede no existir todavía si el espacio nunca publicó desde el Estudio.
DO $$ BEGIN
  IF to_regclass('public.meta_posts') IS NOT NULL THEN
    ALTER TABLE meta_posts ADD COLUMN IF NOT EXISTS "kind" character varying NOT NULL DEFAULT 'post';
  END IF;
END $$;

COMMIT;
