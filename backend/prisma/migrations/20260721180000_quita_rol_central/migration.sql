-- Se elimina el rol `central` del circuito de egresos.
-- El flujo de aprobacion queda en 2 niveles:
--   solicitador -> aprobador -> responsable_almacen (ejecuta la salida).
-- Confirmado con el encargado de almacenes (2026-07-21). Ver CLAUDE.md.

-- 1) Los indices unicos parciales de roles se escribieron a mano (Prisma no
--    expresa `WHERE` en su DSL) y su predicado castea al tipo "Rol". Hay que
--    borrarlos ANTES de recrear el enum: si no, el ALTER COLUMN falla con
--    `operator does not exist: "Rol_new" = "Rol"`. Se recrean al final.
DROP INDEX IF EXISTS "uq_central_por_almacen";
DROP INDEX IF EXISTS "uq_aprobador_por_unidad";
DROP INDEX IF EXISTS "uq_responsable_por_almacen";

-- 2) Recrear el enum sin `central`. Falla a proposito si quedara alguna fila
--    con ese rol (no habia ninguna al momento de escribir esta migracion).
CREATE TYPE "Rol_new" AS ENUM ('super_admin', 'admin', 'solicitador', 'aprobador', 'responsable_almacen', 'observador_almacen');
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "Rol_new" USING ("rol"::text::"Rol_new");
ALTER TYPE "Rol" RENAME TO "Rol_old";
ALTER TYPE "Rol_new" RENAME TO "Rol";
DROP TYPE "public"."Rol_old";

-- 3) Se recrean los dos indices que sobreviven (ya no existe el de central).
CREATE UNIQUE INDEX "uq_aprobador_por_unidad"
ON "usuarios" ("unidad_id")
WHERE "rol" = 'aprobador' AND "activo" = true;

CREATE UNIQUE INDEX "uq_responsable_por_almacen"
ON "usuarios" ("almacen_id")
WHERE "rol" = 'responsable_almacen' AND "activo" = true;

-- 4) `nombre` y `cargo` pasan a guardarse siempre en MAYUSCULAS: se normalizan
--    las filas existentes para que el dato viejo no quede mezclado.
UPDATE "usuarios"
SET "nombre" = UPPER("nombre"),
    "cargo" = UPPER("cargo");
