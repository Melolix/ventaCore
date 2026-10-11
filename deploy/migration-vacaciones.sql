-- Modo vacaciones de Mercado Libre: marca las publicaciones que pausó el modo
-- vacaciones, para reactivar solo esas al volver. Idempotente.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS "mlVacation" boolean NOT NULL DEFAULT false;
