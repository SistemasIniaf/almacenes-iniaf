-- CreateEnum
CREATE TYPE "EstadoIngreso" AS ENUM ('BORRADOR', 'CONFIRMADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'REVERSION');

-- CreateTable
CREATE TABLE "ingresos" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoIngreso" NOT NULL DEFAULT 'BORRADOR',
    "numero" INTEGER,
    "gestion" INTEGER,
    "almacen_id" INTEGER NOT NULL,
    "fecha_remision" TIMESTAMP(3),
    "nota_remision" TEXT,
    "proceso_c31" TEXT,
    "certificacion" TEXT,
    "informe_conformidad" TEXT,
    "fecha_informe_conformidad" TIMESTAMP(3),
    "numero_factura" TEXT,
    "observacion" TEXT,
    "proveedor_id" INTEGER,
    "fuente_financiamiento_id" INTEGER,
    "responsable_conformidad_id" INTEGER,
    "unidad_solicitante_id" INTEGER,
    "registrado_por_id" INTEGER NOT NULL,
    "anulado_por_id" INTEGER,
    "anulado_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_detalles" (
    "id" SERIAL NOT NULL,
    "ingreso_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,5) NOT NULL,
    "saldo_cantidad" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingreso_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_kardex" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "item_id" INTEGER NOT NULL,
    "almacen_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,5) NOT NULL,
    "ingreso_id" INTEGER,
    "ingreso_detalle_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_kardex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingresos_almacen_id_idx" ON "ingresos"("almacen_id");

-- CreateIndex
CREATE INDEX "ingresos_estado_idx" ON "ingresos"("estado");

-- CreateIndex
CREATE INDEX "ingresos_fuente_financiamiento_id_idx" ON "ingresos"("fuente_financiamiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_almacen_id_gestion_numero_key" ON "ingresos"("almacen_id", "gestion", "numero");

-- CreateIndex
CREATE INDEX "ingreso_detalles_ingreso_id_idx" ON "ingreso_detalles"("ingreso_id");

-- CreateIndex
CREATE INDEX "ingreso_detalles_item_id_idx" ON "ingreso_detalles"("item_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_item_id_almacen_id_idx" ON "movimientos_kardex"("item_id", "almacen_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_ingreso_id_idx" ON "movimientos_kardex"("ingreso_id");

-- CreateIndex
CREATE INDEX "movimientos_kardex_ingreso_detalle_id_idx" ON "movimientos_kardex"("ingreso_detalle_id");

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_fuente_financiamiento_id_fkey" FOREIGN KEY ("fuente_financiamiento_id") REFERENCES "fuentes_financiamiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_responsable_conformidad_id_fkey" FOREIGN KEY ("responsable_conformidad_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_unidad_solicitante_id_fkey" FOREIGN KEY ("unidad_solicitante_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_detalles" ADD CONSTRAINT "ingreso_detalles_ingreso_id_fkey" FOREIGN KEY ("ingreso_id") REFERENCES "ingresos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_detalles" ADD CONSTRAINT "ingreso_detalles_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_ingreso_id_fkey" FOREIGN KEY ("ingreso_id") REFERENCES "ingresos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_kardex" ADD CONSTRAINT "movimientos_kardex_ingreso_detalle_id_fkey" FOREIGN KEY ("ingreso_detalle_id") REFERENCES "ingreso_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
