-- El ingreso pasa a tener FECHA PROPIA y deja de depender de la fecha de remision.
--
-- POR QUE: `fecha_remision` es la fecha del documento del proveedor, la tipea a
-- mano el responsable de almacen, y gobernaba cuatro cosas — la gestion (y con
-- ella el correlativo `001/2026`), la fecha del movimiento de Kardex, el orden
-- en que se consumen los lotes y la validacion de alta. Un error de tipeo en el
-- ano mandaba el ingreso a otra gestion y descolocaba el libro.
--
-- AHORA: `fecha_ingreso` se estampa sola al registrar y es la que tiene efecto
-- contable. `fecha_remision` se conserva como dato del documento (se sigue
-- pidiendo e imprimiendo), pero ya no gobierna nada. Solo el super_admin puede
-- corregir `fecha_ingreso` — el caso previsto es el cierre de gestion.
--
-- Se escribe a mano porque la columna es NOT NULL y hay filas existentes: hay
-- que poblarla antes de exigirla.

-- AlterTable
ALTER TABLE "ingresos" ADD COLUMN "fecha_ingreso" TIMESTAMP(3);

-- Los ingresos ya registrados conservan EXACTAMENTE el comportamiento que
-- tenian: su gestion, su correlativo y sus movimientos de Kardex se derivaron de
-- `fecha_remision`, asi que esa misma fecha pasa a ser su fecha de ingreso. El
-- COALESCE cubre el caso teorico de una fila sin remision (la columna es
-- nullable en la BD aunque el service la exija).
UPDATE "ingresos" SET "fecha_ingreso" = COALESCE("fecha_remision", "created_at");

ALTER TABLE "ingresos" ALTER COLUMN "fecha_ingreso" SET NOT NULL;

-- El listado y el detalle de stock ordenan los lotes por esta fecha (el mas
-- antiguo primero, que es el orden en que se van a consumir).
CREATE INDEX "ingresos_fecha_ingreso_idx" ON "ingresos"("fecha_ingreso");
