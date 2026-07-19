-- Busqueda insensible a acentos en todos los listados.
--
-- PROBLEMA: el `mode: 'insensitive'` de Prisma se traduce a ILIKE, que ignora
-- mayusculas pero NO diacriticos. Buscar "almacen" no encontraba "Almacén" y
-- "juridica" no encontraba "Unidad Jurídica" — en la practica nadie escribe
-- tildes al buscar, asi que los buscadores devolvian vacio.
--
-- SOLUCION: extension `unaccent` + indices GIN de trigramas sobre la expresion
-- f_unaccent(columna), que es lo que consultan los services.
--
-- Prisma no puede expresar `unaccent(...)` en su DSL, por eso esta migracion se
-- escribe a mano (mismo caso que los indices unicos parciales de usuarios).

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- `unaccent` es STABLE, no IMMUTABLE (depende del diccionario de configuracion),
-- y Postgres no admite funciones STABLE en indices. Este wrapper fija el
-- diccionario explicitamente, lo que la vuelve IMMUTABLE y por tanto indexable.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Indices de trigramas: soportan ILIKE '%texto%' (comodin al inicio), que es lo
-- que hace el buscador. Un btree normal no sirve para patrones con % adelante.
-- Cada indice cubre exactamente las columnas que busca el `q` de su modulo.

-- unidades: q busca en nombre y sigla
CREATE INDEX idx_unidades_nombre_unaccent ON unidades USING gin (f_unaccent(nombre) gin_trgm_ops);
CREATE INDEX idx_unidades_sigla_unaccent ON unidades USING gin (f_unaccent(sigla) gin_trgm_ops);

-- almacenes: q busca en nombre
CREATE INDEX idx_almacenes_nombre_unaccent ON almacenes USING gin (f_unaccent(nombre) gin_trgm_ops);

-- usuarios: q busca en nombre y usuario
CREATE INDEX idx_usuarios_nombre_unaccent ON usuarios USING gin (f_unaccent(nombre) gin_trgm_ops);
CREATE INDEX idx_usuarios_usuario_unaccent ON usuarios USING gin (f_unaccent(usuario) gin_trgm_ops);

-- proveedores: q busca en nombre, nit y contacto
CREATE INDEX idx_proveedores_nombre_unaccent ON proveedores USING gin (f_unaccent(nombre) gin_trgm_ops);
CREATE INDEX idx_proveedores_nit_unaccent ON proveedores USING gin (f_unaccent(nit) gin_trgm_ops);
CREATE INDEX idx_proveedores_contacto_unaccent ON proveedores USING gin (f_unaccent(contacto) gin_trgm_ops);

-- partidas: q busca en codigo y denominacion
CREATE INDEX idx_partidas_codigo_unaccent ON partidas USING gin (f_unaccent(codigo) gin_trgm_ops);
CREATE INDEX idx_partidas_denominacion_unaccent ON partidas USING gin (f_unaccent(denominacion) gin_trgm_ops);

-- items: q busca en codigo y descripcion
CREATE INDEX idx_items_codigo_unaccent ON items USING gin (f_unaccent(codigo) gin_trgm_ops);
CREATE INDEX idx_items_descripcion_unaccent ON items USING gin (f_unaccent(descripcion) gin_trgm_ops);
