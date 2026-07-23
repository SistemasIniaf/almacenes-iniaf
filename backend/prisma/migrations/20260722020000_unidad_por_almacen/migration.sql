-- Unidad pasa a pertenecer a UN almacen (modelo 1-a-muchos): el selector de
-- "unidad solicitante" del Ingreso mostrara solo las unidades de su almacen.
-- Ademas, nombre y sigla dejan de ser unicos globalmente y pasan a ser unicos
-- POR ALMACEN (para que "DEPARTAMENTAL" pueda repetirse entre departamentales).
-- Prisma no expresa el backfill de datos, por eso la migracion se escribe a mano.

-- 1. Columna nullable para poder poblarla
ALTER TABLE "unidades" ADD COLUMN "almacen_id" INTEGER;

-- 2. Backfill: las unidades existentes van al Almacen Nacional (si existe uno con
--    "nacional" en el nombre), si no al primer almacen. Todas las que ya habia son
--    el organigrama nacional.
UPDATE "unidades" SET "almacen_id" = COALESCE(
  (SELECT id FROM "almacenes" WHERE f_unaccent(nombre) ILIKE f_unaccent('%nacional%') ORDER BY id LIMIT 1),
  (SELECT id FROM "almacenes" ORDER BY id LIMIT 1)
);

-- 3. Obligatorio + FK + indice
ALTER TABLE "unidades" ALTER COLUMN "almacen_id" SET NOT NULL;
ALTER TABLE "unidades"
  ADD CONSTRAINT "unidades_almacen_id_fkey"
  FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "unidades_almacen_id_idx" ON "unidades"("almacen_id");

-- 4. Unicidad: de global a por-almacen
DROP INDEX "unidades_nombre_key";
DROP INDEX "unidades_sigla_key";
CREATE UNIQUE INDEX "unidades_almacen_id_nombre_key" ON "unidades"("almacen_id", "nombre");
CREATE UNIQUE INDEX "unidades_almacen_id_sigla_key" ON "unidades"("almacen_id", "sigla");
