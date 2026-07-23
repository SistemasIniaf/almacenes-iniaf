-- Indices GIN de trigramas para el buscador `q` de ingresos (sin acentos).
-- El service busca con f_unaccent(col) ILIKE f_unaccent($1) sobre estas columnas
-- (ver common/search/busqueda-texto.ts). Prisma no expresa unaccent en su DSL,
-- por eso va a mano, igual que el resto de los buscadores.

CREATE INDEX idx_ingresos_nota_remision_unaccent ON ingresos USING gin (f_unaccent(nota_remision) gin_trgm_ops);
CREATE INDEX idx_ingresos_proceso_c31_unaccent ON ingresos USING gin (f_unaccent(proceso_c31) gin_trgm_ops);
CREATE INDEX idx_ingresos_numero_factura_unaccent ON ingresos USING gin (f_unaccent(numero_factura) gin_trgm_ops);
