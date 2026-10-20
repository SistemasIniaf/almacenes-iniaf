-- Historial de logos: cada logo subido pasa a ser una VERSION (logo_versiones)
-- y logos_institucionales deja de guardar la ruta para apuntar a la version
-- vigente. Escrita a mano: Prisma no sabe pasar las filas existentes al
-- historial antes de volver obligatoria la columna nueva.

-- CreateTable
CREATE TABLE "logo_versiones" (
    "id" SERIAL NOT NULL,
    "clave" "LogoClave" NOT NULL,
    "url" TEXT NOT NULL,
    "subido_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logo_versiones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logo_versiones_clave_idx" ON "logo_versiones"("clave");

ALTER TABLE "logo_versiones" ADD CONSTRAINT "logo_versiones_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los logos que ya estaban reemplazados se vuelven su primera version.
INSERT INTO "logo_versiones" ("clave", "url", "subido_por_id", "created_at")
SELECT "clave", "url", "actualizado_por_id", "updated_at" FROM "logos_institucionales";

ALTER TABLE "logos_institucionales" ADD COLUMN "version_id" INTEGER;

UPDATE "logos_institucionales" l
SET "version_id" = v."id"
FROM "logo_versiones" v
WHERE v."clave" = l."clave";

ALTER TABLE "logos_institucionales" ALTER COLUMN "version_id" SET NOT NULL;
ALTER TABLE "logos_institucionales" DROP COLUMN "url";

CREATE UNIQUE INDEX "logos_institucionales_version_id_key" ON "logos_institucionales"("version_id");

ALTER TABLE "logos_institucionales" ADD CONSTRAINT "logos_institucionales_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "logo_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
