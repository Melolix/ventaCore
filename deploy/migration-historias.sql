-- ============================================================
--  Migración: Historias de Instagram en el Estudio
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  Crea meta_posts (el historial de publicaciones del Estudio) con la columna
--  kind ('post' | 'story'), que distingue un post del feed de una Historia.
--
--  OJO: la tabla nunca llegó a existir en ninguna base — la entidad estaba en el
--  módulo social pero faltaba en el array `entities` de app.module, así que
--  synchronize nunca la creaba. Por eso esto es un CREATE y no solo un ALTER.
--
--  Idempotente: IF NOT EXISTS en todo → re-correrla es segura. Si el deploy
--  corre con DB_SYNCHRONIZE=true, TypeORM ya la crea solo y esto no hace nada;
--  este archivo es el respaldo para cuando synchronize esté apagado.
--  Reproduce EXACTO el esquema que TypeORM genera (mismos nombres de índices).
-- ============================================================
BEGIN;

-- Requerido por el default uuid_generate_v4() (ya suele estar activo).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS meta_posts (
  "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
  "rubroId"     uuid NOT NULL,
  "espacioId"   uuid NOT NULL,
  "productoId"  uuid,
  "network"     character varying NOT NULL,
  "kind"        character varying NOT NULL DEFAULT 'post',
  "imageUrl"    text NOT NULL,
  "caption"     text,
  "mediaId"     character varying,
  "permalink"   character varying,
  "status"      character varying NOT NULL DEFAULT 'published',
  "createdAt"   timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PK_a35a252003db51007e8f17cc14a" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IDX_4c4dda31bb6693cf89b4f5737d" ON meta_posts ("rubroId");
CREATE INDEX IF NOT EXISTS "IDX_814bf9b2f228f729122ee1bb35" ON meta_posts ("espacioId");

-- Por si en alguna base la tabla ya existía sin la columna nueva.
ALTER TABLE meta_posts ADD COLUMN IF NOT EXISTS "kind" character varying NOT NULL DEFAULT 'post';

COMMIT;
