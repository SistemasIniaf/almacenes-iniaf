import type { Prisma } from '../../generated/prisma/client';

/**
 * Cada serie de documentos tiene su numero fijo como primera clave del bloqueo,
 * asi un ingreso y un egreso del mismo almacen no se esperan entre si. No
 * cambiar los valores con transacciones en vuelo.
 */
const SERIES = { ingresos: 1, egresos: 2 } as const;

/**
 * Serializa la asignacion de correlativos de UNA serie en UN almacen hasta el
 * fin de la transaccion.
 *
 * El numero se calcula como `MAX + 1`, y dos transacciones que lo leen a la vez
 * obtienen el mismo. El `@@unique([almacenId, gestion, numero])` impide grabar
 * el duplicado, pero el segundo usuario se llevaba un error 500 sin saber por
 * que. Con este bloqueo la segunda transaccion espera a que la primera termine y
 * recien ahi lee el MAX, que ya incluye el numero recien asignado.
 *
 * Es un advisory lock de Postgres (`pg_advisory_xact_lock`): no bloquea filas de
 * ninguna tabla, solo a quien pida el mismo par de claves, y se suelta solo al
 * terminar la transaccion (commit o rollback). Va JUSTO antes de leer el MAX.
 */
export async function bloquearSerie(
  tx: Prisma.TransactionClient,
  serie: keyof typeof SERIES,
  almacenId: number,
) {
  // `$executeRaw` y no `$queryRaw`: la funcion devuelve `void`, que Prisma no
  // sabe deserializar como columna.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIES[serie]}::int, ${almacenId}::int)`;
}
