-- Fechas con zona horaria (2026-11-05).
--
-- Hasta acá todas las fechas eran `timestamp(3)` SIN zona: guardaban el instante
-- en UTC pero la columna no lo decía, así que al mirar la base (pgAdmin, psql)
-- un registro de las 10:00 de Bolivia aparecía a las 14:00. Para auditoría hace
-- falta leerlas en hora local.
--
-- Escrita a mano sobre lo que generó Prisma:
-- 1. Cada columna pasa a `timestamptz` con `USING ... AT TIME ZONE 'UTC'`: los
--    valores guardados SON UTC (el driver los escribe así). Sin el USING,
--    Postgres los interpretaría en la zona de la sesión y, si no fuera UTC,
--    correría todas las horas. Los instantes no cambian: solo el tipo.
-- 2. La base queda en `America/La_Paz`, así cualquier conexión (pgAdmin, psql,
--    pg_dump) muestra las fechas en hora de Bolivia. A la aplicación no le
--    cambia nada: con timestamptz el driver recibe el instante con su desfase.
--    Se usa `current_database()` porque el nombre de la base no es el mismo en
--    desarrollo y en producción. Rige para las conexiones NUEVAS.

-- AlterTable
ALTER TABLE "almacenes" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "configuracion_sistema" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "egreso_detalles" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "egreso_historial" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "egresos" ALTER COLUMN "fecha_envio" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_envio" AT TIME ZONE 'UTC',
ALTER COLUMN "fecha_entrega" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_entrega" AT TIME ZONE 'UTC',
ALTER COLUMN "anulado_en" SET DATA TYPE TIMESTAMPTZ(3) USING "anulado_en" AT TIME ZONE 'UTC',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
ALTER COLUMN "reserva_desde" SET DATA TYPE TIMESTAMPTZ(3) USING "reserva_desde" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "fuentes_financiamiento" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ingreso_detalles" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ingresos" ALTER COLUMN "fecha_remision" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_remision" AT TIME ZONE 'UTC',
ALTER COLUMN "fecha_informe_conformidad" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_informe_conformidad" AT TIME ZONE 'UTC',
ALTER COLUMN "anulado_en" SET DATA TYPE TIMESTAMPTZ(3) USING "anulado_en" AT TIME ZONE 'UTC',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
ALTER COLUMN "fecha_ingreso" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_ingreso" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "items" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "logo_versiones" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "logos_institucionales" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "movimientos_kardex" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "partidas" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "proveedores" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "traspaso_detalles" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "traspasos" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "unidades" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "usuario_almacen_observado" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- Zona horaria de la base
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/La_Paz');
END
$$;
