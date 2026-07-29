-- CreateEnum
CREATE TYPE "EstadoEgreso" AS ENUM ('BORRADOR', 'PENDIENTE_APROBADOR', 'PENDIENTE_RESPONSABLE_ALMACEN', 'ENTREGADO', 'ANULADO');

-- AlterTable
ALTER TABLE "movimientos_kardex" ADD COLUMN     "egreso_detalle_id" INTEGER,
ADD COLUMN     "egreso_id" INTEGER;

-- CreateTable
CREATE TABLE "egresos" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoEgreso" NOT NULL DEFAULT 'BORRADOR',
    "numero" INTEGER,
    "gestion" INTEGER,
    "almacen_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "solicitante_id" INTEGER NOT NULL,
    "justificacion" TEXT NOT NULL,
    "fecha_envio" TIMESTAMP(3),
    "fecha_entrega" TIMESTAMP(3),
    "entregado_por_id" INTEGER,
    "anulado_por_id" INTEGER,
    "anulado_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egreso_detalles" (
    "id" SERIAL NOT NULL,
    "egreso_id" INTEGER NOT NULL,
    "ingreso_detalle_id" INTEGER NOT NULL,
    "cantidad_solicitada" DECIMAL(12,2) NOT NULL,
    "cantidad_entregada" DECIMAL(12,2),
    "observacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egreso_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egreso_historial" (
    "id" SERIAL NOT NULL,
    "egreso_id" INTEGER NOT NULL,
    "estado_anterior" "EstadoEgreso",
    "estado_nuevo" "EstadoEgreso" NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egreso_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "egresos_almacen_id_idx" ON "egresos"("almacen_id");

-- CreateIndex
CREATE INDEX "egresos_unidad_id_idx" ON "egresos"("unidad_id");

-- CreateIndex
CREATE INDEX "egresos_solicitante_id_idx" ON "egresos"("solicitante_id");

-- CreateIndex
CREATE INDEX "egresos_estado_idx" ON "egresos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "egresos_almacen_id_gestion_numero_key" ON "egresos"("almacen_id", "gestion", "numero");

-- CreateIndex
CREATE INDEX "egreso_detalles_egreso_id_idx" ON "egreso_detalles"("egreso_id");

-- CreateIndex
CREATE INDEX "egreso_detalles_ingreso_detalle_id_idx" ON "egreso_detalles"("ingreso_detalle_id");

-- CreateIndex
CREATE INDEX "egreso_historial_egreso_id_idx" ON "egreso_historial"("egreso_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_egreso_id_idx" ON "movimientos_kardex"("egreso_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_egreso_detalle_id_idx" ON "movimientos_kardex"("egreso_detalle_id");

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egresos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_egreso_detalle_id_fkey" FOREIGN KEY ("egreso_detalle_id") REFERENCES "egreso_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_entregado_por_id_fkey" FOREIGN KEY ("entregado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso_detalles" ADD CONSTRAINT "egreso_detalles_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egresos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso_detalles" ADD CONSTRAINT "egreso_detalles_ingreso_detalle_id_fkey" FOREIGN KEY ("ingreso_detalle_id") REFERENCES "ingreso_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso_historial" ADD CONSTRAINT "egreso_historial_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egresos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso_historial" ADD CONSTRAINT "egreso_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
