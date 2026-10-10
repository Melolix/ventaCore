-- ============================================================
--  Migración: pedidos de la tienda + datos para transferir
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  - Tabla pedidos: el carrito que el cliente envía desde la vitrina, con número
--    correlativo por rubro, token de seguimiento, ítems y estado.
--  - rubros."pagoAlias" / "pagoCbu" / "pagoTitular": datos para transferir.
--
--  Idempotente: IF NOT EXISTS en todo → re-correrla es segura. Con
--  DB_SYNCHRONIZE=true TypeORM ya lo crea solo; este archivo es el respaldo
--  para cuando synchronize esté apagado (los índices pueden diferir de nombre).
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS pedidos (
  "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
  "rubroId"          uuid NOT NULL,
  "espacioId"        uuid NOT NULL,
  "numero"           integer NOT NULL,
  "token"            character varying NOT NULL,
  "status"           character varying NOT NULL DEFAULT 'pendiente',
  "clienteNombre"    character varying NOT NULL,
  "clienteTelefono"  character varying NOT NULL,
  "entrega"          character varying NOT NULL DEFAULT 'retiro',
  "direccion"        character varying,
  "notas"            text,
  "items"            jsonb NOT NULL DEFAULT '[]',
  "total"            numeric(14,2) NOT NULL,
  "motivo"           text,
  "stockDescontado"  boolean NOT NULL DEFAULT false,
  "createdAt"        timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt"        timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PK_pedidos" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IDX_pedidos_rubro" ON pedidos ("rubroId");
CREATE INDEX IF NOT EXISTS "IDX_pedidos_espacio" ON pedidos ("espacioId");
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pedidos_token" ON pedidos ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pedidos_rubro_numero" ON pedidos ("rubroId", "numero");

ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "pagoAlias" character varying;
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "pagoCbu" character varying;
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "pagoTitular" character varying;

COMMIT;
