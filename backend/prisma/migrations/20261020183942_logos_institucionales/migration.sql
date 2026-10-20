-- CreateEnum
CREATE TYPE "LogoClave" AS ENUM ('INIAF', 'INIAF_OSCURO', 'MINISTERIO');

-- CreateTable
CREATE TABLE "logos_institucionales" (
    "clave" "LogoClave" NOT NULL,
    "url" TEXT NOT NULL,
    "actualizado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logos_institucionales_pkey" PRIMARY KEY ("clave")
);

-- AddForeignKey
ALTER TABLE "logos_institucionales" ADD CONSTRAINT "logos_institucionales_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
