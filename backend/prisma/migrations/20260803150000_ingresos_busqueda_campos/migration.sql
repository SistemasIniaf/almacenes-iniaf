-- El buscador `q` del listado de ingresos pasa a mirar OTRAS columnas:
-- proceso/C31, certificacion y observacion (antes: nota de remision, C31 y
-- Nº de factura). Decision del encargado — son los datos por los que de verdad
-- se busca un ingreso.
--
-- Los indices GIN de trigramas acompañan al cambio: sin ellos la busqueda
-- funciona igual pero hace scan secuencial (ver CLAUDE.md, "Buscador q").

-- Nuevos: los dos campos que antes no se buscaban.
CREATE INDEX idx_ingresos_certificacion_unaccent ON ingresos USING gin (f_unaccent(certificacion) gin_trgm_ops);
CREATE INDEX idx_ingresos_observacion_unaccent ON ingresos USING gin (f_unaccent(observacion) gin_trgm_ops);

-- Se van los de las columnas que el buscador ya no consulta. Un indice GIN de
-- trigramas no es gratis: se mantiene en cada INSERT/UPDATE de la tabla.
-- `idx_ingresos_proceso_c31_unaccent` se conserva: C31 sigue siendo criterio.
DROP INDEX IF EXISTS idx_ingresos_nota_remision_unaccent;
DROP INDEX IF EXISTS idx_ingresos_numero_factura_unaccent;
