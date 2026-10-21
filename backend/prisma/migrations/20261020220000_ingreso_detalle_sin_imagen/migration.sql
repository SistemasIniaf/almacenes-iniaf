-- Se elimina la foto por LOTE: la institucion decidio que solo el ITEM lleva
-- foto (la de catalogo). Donde se mostraba `lote.imagenUrl ?? item.imagenUrl`
-- ahora va siempre la del item.
--
-- OJO: borra las rutas guardadas. Los archivos de `uploads/lotes/` que hubiera
-- quedan huerfanos en disco y se pueden borrar a mano.
ALTER TABLE "ingreso_detalles" DROP COLUMN "imagen_url";
