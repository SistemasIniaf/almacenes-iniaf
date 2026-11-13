-- AlterTable
ALTER TABLE "ingreso_detalles" ADD COLUMN     "lote_anterior_id" INTEGER;

-- AlterTable
ALTER TABLE "ingresos" ADD COLUMN     "saldo_inicial" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ingreso_detalles_lote_anterior_id_idx" ON "ingreso_detalles"("lote_anterior_id");
