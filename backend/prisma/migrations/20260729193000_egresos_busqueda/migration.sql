-- Buscador del listado de egresos, insensible a acentos.
--
-- Misma solucion que el resto de los modulos: indice GIN de trigramas sobre
-- f_unaccent(columna), que es exactamente lo que consulta `buscarIdsPorTexto`.
-- Sin esto el buscador FUNCIONA igual, pero hace scan secuencial de la tabla.
-- Ver 20260719161128_busqueda_sin_acentos.

CREATE INDEX idx_egresos_justificacion_unaccent
  ON egresos USING gin (f_unaccent(justificacion) gin_trgm_ops);
