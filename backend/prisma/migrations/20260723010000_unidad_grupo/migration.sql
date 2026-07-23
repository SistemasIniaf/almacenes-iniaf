-- Grupo de la unidad (MOF, OTROS...). Lo elige la raiz; los hijos lo heredan.
-- Sirve para mostrar el catalogo en tablas por grupo y agrupar el selector del
-- almacen (que muestra solo las unidades raiz de cada grupo).

ALTER TABLE "unidades" ADD COLUMN "grupo" TEXT;

-- Backfill: las unidades que ya existen son el organigrama nacional -> MOF.
-- (El seed corrige los rubros departamentales a OTROS.)
UPDATE "unidades" SET "grupo" = 'MOF' WHERE "grupo" IS NULL;

CREATE INDEX "unidades_grupo_idx" ON "unidades"("grupo");
