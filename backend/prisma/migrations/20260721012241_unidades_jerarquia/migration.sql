-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "padre_id" INTEGER;

-- CreateIndex
CREATE INDEX "unidades_padre_id_idx" ON "unidades"("padre_id");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
