-- Unidad pasa de 1-a-muchos a MUCHOS-A-MUCHOS con Almacen: las unidades son un
-- catalogo compartido y cada almacen SELECCIONA cuales muestra. Asi los rubros
-- departamentales (Adm. y Finanzas, Departamental, ...) se crean una sola vez y
-- se reusan en cada almacen departamental (en vez de duplicarlos por almacen).

-- 1. Tabla puente Almacen <-> Unidad
CREATE TABLE "almacen_unidad" (
    "almacen_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,

    CONSTRAINT "almacen_unidad_pkey" PRIMARY KEY ("almacen_id", "unidad_id")
);
CREATE INDEX "almacen_unidad_unidad_id_idx" ON "almacen_unidad"("unidad_id");
ALTER TABLE "almacen_unidad"
  ADD CONSTRAINT "almacen_unidad_almacen_id_fkey"
  FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "almacen_unidad"
  ADD CONSTRAINT "almacen_unidad_unidad_id_fkey"
  FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Poblar desde el almacen_id actual (cada unidad queda ligada a su almacen)
INSERT INTO "almacen_unidad" ("almacen_id", "unidad_id")
SELECT "almacen_id", "id" FROM "unidades";

-- 3. Quitar los artefactos del modelo 1-a-muchos
DROP INDEX "unidades_almacen_id_nombre_key";
DROP INDEX "unidades_almacen_id_sigla_key";
DROP INDEX "unidades_almacen_id_idx";
ALTER TABLE "unidades" DROP CONSTRAINT "unidades_almacen_id_fkey";
ALTER TABLE "unidades" DROP COLUMN "almacen_id";

-- 4. Restaurar la unicidad GLOBAL de nombre y sigla (catalogo compartido)
CREATE UNIQUE INDEX "unidades_nombre_key" ON "unidades"("nombre");
CREATE UNIQUE INDEX "unidades_sigla_key" ON "unidades"("sigla");
