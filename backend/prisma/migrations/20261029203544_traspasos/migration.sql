-- AlterTable
ALTER TABLE "ingresos" ADD COLUMN     "traspaso_id" INTEGER;

-- AlterTable
ALTER TABLE "movimientos_kardex" ADD COLUMN     "traspaso_id" INTEGER;

-- CreateTable
CREATE TABLE "traspasos" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "gestion" INTEGER NOT NULL,
    "almacen_origen_id" INTEGER NOT NULL,
    "almacen_destino_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT NOT NULL,
    "registrado_por_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traspasos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traspaso_detalles" (
    "id" SERIAL NOT NULL,
    "traspaso_id" INTEGER NOT NULL,
    "lote_origen_id" INTEGER NOT NULL,
    "lote_destino_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traspaso_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traspasos_almacen_destino_id_idx" ON "traspasos"("almacen_destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "traspasos_almacen_origen_id_gestion_numero_key" ON "traspasos"("almacen_origen_id", "gestion", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "traspaso_detalles_lote_destino_id_key" ON "traspaso_detalles"("lote_destino_id");

-- CreateIndex
CREATE INDEX "traspaso_detalles_traspaso_id_idx" ON "traspaso_detalles"("traspaso_id");

-- CreateIndex
CREATE INDEX "traspaso_detalles_lote_origen_id_idx" ON "traspaso_detalles"("lote_origen_id");

-- CreateIndex
CREATE INDEX "ingresos_traspaso_id_idx" ON "ingresos"("traspaso_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_traspaso_id_idx" ON "movimientos_kardex"("traspaso_id");

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_traspaso_id_fkey" FOREIGN KEY ("traspaso_id") REFERENCES "traspasos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_traspaso_id_fkey" FOREIGN KEY ("traspaso_id") REFERENCES "traspasos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_almacen_origen_id_fkey" FOREIGN KEY ("almacen_origen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_almacen_destino_id_fkey" FOREIGN KEY ("almacen_destino_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspaso_detalles" ADD CONSTRAINT "traspaso_detalles_traspaso_id_fkey" FOREIGN KEY ("traspaso_id") REFERENCES "traspasos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspaso_detalles" ADD CONSTRAINT "traspaso_detalles_lote_origen_id_fkey" FOREIGN KEY ("lote_origen_id") REFERENCES "ingreso_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspaso_detalles" ADD CONSTRAINT "traspaso_detalles_lote_destino_id_fkey" FOREIGN KEY ("lote_destino_id") REFERENCES "ingreso_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
