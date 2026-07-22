-- CreateTable
CREATE TABLE "fuentes_financiamiento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuentes_financiamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuentes_financiamiento_nombre_key" ON "fuentes_financiamiento"("nombre");

-- Busqueda sin acentos (ver 20260719161128_busqueda_sin_acentos): el buscador `q`
-- de este modulo consulta f_unaccent(col) ILIKE f_unaccent($1) sobre nombre y
-- codigo. Sin estos indices GIN de trigramas la busqueda funciona pero hace scan
-- secuencial. Prisma no expresa unaccent en su DSL, por eso se agregan a mano.
CREATE INDEX idx_fuentes_financiamiento_nombre_unaccent ON fuentes_financiamiento USING gin (f_unaccent(nombre) gin_trgm_ops);
CREATE INDEX idx_fuentes_financiamiento_codigo_unaccent ON fuentes_financiamiento USING gin (f_unaccent(codigo) gin_trgm_ops);
