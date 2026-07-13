-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('super_admin', 'admin', 'solicitador', 'aprobador', 'responsable_almacen', 'central', 'observador_almacen');

-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "unidad_id" INTEGER,
    "almacen_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_almacen_observado" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "almacen_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_almacen_observado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "denominacion" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "seleccionable" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_correlativo" INTEGER NOT NULL DEFAULT 0,
    "padre_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad_medida" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "partida_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_nombre_key" ON "unidades"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_sigla_key" ON "unidades"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "almacenes_nombre_key" ON "almacenes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE INDEX "usuarios_unidad_id_idx" ON "usuarios"("unidad_id");

-- CreateIndex
CREATE INDEX "usuarios_almacen_id_idx" ON "usuarios"("almacen_id");

-- CreateIndex
CREATE INDEX "usuario_almacen_observado_almacen_id_idx" ON "usuario_almacen_observado"("almacen_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_almacen_observado_usuario_id_almacen_id_key" ON "usuario_almacen_observado"("usuario_id", "almacen_id");

-- CreateIndex
CREATE UNIQUE INDEX "partidas_codigo_key" ON "partidas"("codigo");

-- CreateIndex
CREATE INDEX "partidas_padre_id_idx" ON "partidas"("padre_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_codigo_key" ON "items"("codigo");

-- CreateIndex
CREATE INDEX "items_partida_id_idx" ON "items"("partida_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_almacen_observado" ADD CONSTRAINT "usuario_almacen_observado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_almacen_observado" ADD CONSTRAINT "usuario_almacen_observado_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "partidas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Indices unicos PARCIALES (agregados a mano: Prisma no soporta WHERE en su DSL).
-- Garantizan unicidad de roles solo entre usuarios ACTIVOS.
-- Complementados con validacion en el service (mensaje claro antes de que falle el indice).
-- ---------------------------------------------------------------------------

-- Un unico aprobador activo por unidad.
CREATE UNIQUE INDEX "uq_aprobador_por_unidad"
ON "usuarios" ("unidad_id")
WHERE "rol" = 'aprobador' AND "activo" = true;

-- Un unico responsable_almacen activo por almacen.
CREATE UNIQUE INDEX "uq_responsable_por_almacen"
ON "usuarios" ("almacen_id")
WHERE "rol" = 'responsable_almacen' AND "activo" = true;

-- Un unico central activo por almacen.
CREATE UNIQUE INDEX "uq_central_por_almacen"
ON "usuarios" ("almacen_id")
WHERE "rol" = 'central' AND "activo" = true;
