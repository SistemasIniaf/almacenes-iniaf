-- CreateTable
CREATE TABLE "cierres_gestion" (
    "id" SERIAL NOT NULL,
    "gestion" INTEGER NOT NULL,
    "almacen_id" INTEGER NOT NULL,
    "anticipado" BOOLEAN NOT NULL DEFAULT false,
    "cerrado_por_id" INTEGER NOT NULL,
    "cerrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor_inicial" DECIMAL(18,2) NOT NULL,
    "valor_entradas" DECIMAL(18,2) NOT NULL,
    "valor_salidas" DECIMAL(18,2) NOT NULL,
    "valor_final" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_gestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_saldos" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "ingreso_detalle_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "fuente_financiamiento_id" INTEGER,
    "precio_unitario" DECIMAL(12,5) NOT NULL,
    "cantidad_inicial" DECIMAL(12,2) NOT NULL,
    "cantidad_entradas" DECIMAL(12,2) NOT NULL,
    "cantidad_entradas_traspaso" DECIMAL(12,2) NOT NULL,
    "cantidad_salidas" DECIMAL(12,2) NOT NULL,
    "cantidad_salidas_traspaso" DECIMAL(12,2) NOT NULL,
    "cantidad_final" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cierre_saldos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierres_gestion_almacen_id_gestion_key" ON "cierres_gestion"("almacen_id", "gestion");

-- CreateIndex
CREATE INDEX "cierre_saldos_item_id_idx" ON "cierre_saldos"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_saldos_cierre_id_ingreso_detalle_id_key" ON "cierre_saldos"("cierre_id", "ingreso_detalle_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_almacen_id_fecha_idx" ON "movimientos_kardex"("almacen_id", "fecha");

-- AddForeignKey
ALTER TABLE "cierres_gestion" ADD CONSTRAINT "cierres_gestion_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_gestion" ADD CONSTRAINT "cierres_gestion_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldos" ADD CONSTRAINT "cierre_saldos_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres_gestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldos" ADD CONSTRAINT "cierre_saldos_ingreso_detalle_id_fkey" FOREIGN KEY ("ingreso_detalle_id") REFERENCES "ingreso_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldos" ADD CONSTRAINT "cierre_saldos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldos" ADD CONSTRAINT "cierre_saldos_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_saldos" ADD CONSTRAINT "cierre_saldos_fuente_financiamiento_id_fkey" FOREIGN KEY ("fuente_financiamiento_id") REFERENCES "fuentes_financiamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
