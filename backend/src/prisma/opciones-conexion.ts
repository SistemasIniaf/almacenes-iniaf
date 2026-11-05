import type { PrismaPg } from '@prisma/adapter-pg';

/**
 * Opciones de conexion a Postgres para el driver adapter de Prisma. Las usan la
 * app y los dos seeds: crear el adapter en otro lado sin ellas lee mal las fechas.
 *
 * La sesion de la APP va SIEMPRE en UTC, aunque la base este configurada en
 * America/La_Paz (migracion `fechas_con_zona_horaria`). Esa zona es para quien
 * mira la base a mano (pgAdmin, psql), no para el sistema: `@prisma/adapter-pg`
 * lee un `timestamptz` descartando el desfase que manda Postgres y poniendole
 * `+00:00` (`normalize_timestamptz`), o sea que da por hecho que la sesion esta
 * en UTC. En una sesion en hora de Bolivia, todas las fechas volvian 4 horas
 * corridas (verificado el 2026-11-05).
 *
 * Las fechas de negocio no dependen de esto: el calendario de Bolivia lo arma
 * `common/fechas/zona-horaria.ts` con desfase fijo.
 */
type OpcionesPg = Extract<
  ConstructorParameters<typeof PrismaPg>[0],
  { connectionString?: string }
>;

export function opcionesConexion(): OpcionesPg {
  return {
    connectionString: process.env.DATABASE_URL as string,
    options: '-c TimeZone=UTC',
  };
}
