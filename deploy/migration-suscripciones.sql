-- ============================================================
--  Migración: Suscripciones / Cobros (Lemon Squeezy + multi-proveedor)
--  Correr en la DB de PRODUCCIÓN (apuntá tu DB visualizer a la base real).
--
--  Crea las 4 tablas del módulo payments + la columna rubros.subscriptionsEnabled.
--  Idempotente: usa IF NOT EXISTS / guardas por si ya existen → re-correrla es seguro.
--  Reproduce EXACTO el esquema que TypeORM genera en dev (mismos nombres de
--  enums), así queda consistente aunque en algún momento se prenda synchronize.
-- ============================================================
BEGIN;

-- Requerido por los defaults uuid_generate_v4() (ya suele estar activo).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tipos enum (CREATE TYPE no soporta IF NOT EXISTS → guardas por duplicado) ──
DO $$ BEGIN
  CREATE TYPE payment_provider_configs_provider_enum AS ENUM ('lemon_squeezy', 'mercado_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plans_intervalo_enum AS ENUM ('month', 'year');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plans_provider_enum AS ENUM ('lemon_squeezy', 'mercado_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscriptions_provider_enum AS ENUM ('lemon_squeezy', 'mercado_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscriptions_status_enum AS ENUM ('pending', 'active', 'past_due', 'paused', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_events_provider_enum AS ENUM ('lemon_squeezy', 'mercado_pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Credenciales del proveedor por espacio (secretos cifrados) ──
CREATE TABLE IF NOT EXISTS payment_provider_configs (
  "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
  "espacioId"     uuid NOT NULL,
  "provider"      payment_provider_configs_provider_enum NOT NULL,
  "apiKey"        text,
  "storeId"       varchar,
  "webhookSecret" text,
  "active"        boolean NOT NULL DEFAULT false,
  "createdAt"     timestamp NOT NULL DEFAULT now(),
  "updatedAt"     timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_payment_provider_configs" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_ppc_espacio" ON payment_provider_configs ("espacioId");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ppc_espacio_provider" ON payment_provider_configs ("espacioId", "provider");

-- ── Planes de suscripción por rubro ──
CREATE TABLE IF NOT EXISTS subscription_plans (
  "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
  "rubroId"           uuid NOT NULL,
  "espacioId"         uuid NOT NULL,
  "nombre"            varchar NOT NULL,
  "descripcion"       text,
  "precio"            numeric(12,2) NOT NULL DEFAULT 0,
  "moneda"            varchar NOT NULL DEFAULT 'USD',
  "intervalo"         subscription_plans_intervalo_enum NOT NULL DEFAULT 'month',
  "provider"          subscription_plans_provider_enum NOT NULL DEFAULT 'lemon_squeezy',
  "providerVariantId" varchar,
  "active"            boolean NOT NULL DEFAULT true,
  "orden"             integer NOT NULL DEFAULT 0,
  "createdAt"         timestamp NOT NULL DEFAULT now(),
  "updatedAt"         timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_plans_rubro" ON subscription_plans ("rubroId");
CREATE INDEX IF NOT EXISTS "IDX_plans_espacio" ON subscription_plans ("espacioId");

-- ── Suscripciones registradas (fuente de verdad: webhooks del proveedor) ──
CREATE TABLE IF NOT EXISTS subscriptions (
  "id"                     uuid NOT NULL DEFAULT uuid_generate_v4(),
  "espacioId"              uuid NOT NULL,
  "rubroId"                uuid NOT NULL,
  "planId"                 uuid,
  "provider"               subscriptions_provider_enum NOT NULL,
  "providerSubscriptionId" varchar,
  "providerCustomerId"     varchar,
  "subscriberEmail"        varchar NOT NULL,
  "subscriberName"         varchar,
  "status"                 subscriptions_status_enum NOT NULL DEFAULT 'pending',
  "currentPeriodEnd"       timestamptz,
  "precio"                 numeric(12,2),
  "moneda"                 varchar,
  "cancelledAt"            timestamptz,
  "metadata"               jsonb,
  "createdAt"              timestamp NOT NULL DEFAULT now(),
  "updatedAt"              timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_subs_espacio" ON subscriptions ("espacioId");
CREATE INDEX IF NOT EXISTS "IDX_subs_rubro" ON subscriptions ("rubroId");
CREATE INDEX IF NOT EXISTS "IDX_subs_email" ON subscriptions ("subscriberEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subs_provider_subid" ON subscriptions ("provider", "providerSubscriptionId");

-- ── Log de webhooks (auditoría + idempotencia por providerEventId) ──
CREATE TABLE IF NOT EXISTS subscription_events (
  "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
  "subscriptionId"  uuid,
  "provider"        subscription_events_provider_enum NOT NULL,
  "eventType"       varchar NOT NULL,
  "providerEventId" varchar NOT NULL,
  "payload"         jsonb,
  "receivedAt"      timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_subscription_events" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_events_subscription" ON subscription_events ("subscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_events_provider_event" ON subscription_events ("providerEventId");

-- ── Flag en rubros: habilita el tab de suscripciones en la vitrina ──
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS "subscriptionsEnabled" boolean NOT NULL DEFAULT false;

COMMIT;

-- ── Verificación (opcional) ──
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('payment_provider_configs','subscription_plans','subscriptions','subscription_events')
ORDER BY table_name;
