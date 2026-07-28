-- Quita el estado BORRADOR del enum EstadoIngreso. Ahora el ingreso se crea
-- DEFINITIVO en un solo paso (numero + lotes + Kardex), sin paso de borrador.

-- 1. Los borradores existentes nunca tocaron stock ni Kardex (numero null):
--    se eliminan junto con sus lineas. No hay reversion que hacer.
DELETE FROM "ingreso_detalles"
WHERE "ingreso_id" IN (SELECT "id" FROM "ingresos" WHERE "estado" = 'BORRADOR');

DELETE FROM "ingresos" WHERE "estado" = 'BORRADOR';

-- 2. Recrear el enum sin BORRADOR (Postgres no permite quitar un valor en uso).
--    El unico consumidor del tipo es ingresos.estado; su indice se reconstruye
--    solo al reescribir la columna.
ALTER TABLE "ingresos" ALTER COLUMN "estado" DROP DEFAULT;

ALTER TYPE "EstadoIngreso" RENAME TO "EstadoIngreso_old";

CREATE TYPE "EstadoIngreso" AS ENUM ('CONFIRMADO', 'ANULADO');

ALTER TABLE "ingresos"
  ALTER COLUMN "estado" TYPE "EstadoIngreso"
  USING ("estado"::text::"EstadoIngreso");

ALTER TABLE "ingresos" ALTER COLUMN "estado" SET DEFAULT 'CONFIRMADO';

DROP TYPE "EstadoIngreso_old";
