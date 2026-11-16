import { ConflictException } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';

/**
 * Clave del advisory lock del cierre de gestion. Comparte el espacio de claves
 * con `bloquearSerie` (common/correlativo/), donde el 5 esta reservado.
 */
const CLAVE_CIERRE = 5;

/**
 * Rechaza la operacion si alguna de las `gestiones` ya esta CERRADA en ese
 * almacen (2026-11-16, ver docs/decisiones-ingresos.md §9). Se llama DENTRO de
 * la transaccion de toda operacion que escribe en el kardex, edita un documento
 * o le estampa numero:
 *
 * - la gestion del DOCUMENTO que se toca (anular o editar un ingreso, anular
 *   una entrega), porque una gestion cerrada queda congelada;
 * - la gestion de HOY cuando el movimiento se fecha «ahora» (una reversion, una
 *   entrega, un traspaso), porque la gestion en curso tambien se puede cerrar
 *   (cierre anticipado) y entonces el almacen queda quieto hasta el 1/1.
 *
 * «Cerrada» es cualquier gestion <= la ultima cerrada, no solo las que tienen
 * fila: los cierres van en orden, y algo fechado ANTES del primer cierre
 * cambiaria el saldo de apertura de la foto.
 *
 * Toma el lock COMPARTIDO del almacen: muchas operaciones pueden correr a la
 * vez, pero el cierre (que toma el EXCLUSIVO, `bloquearCierre`) espera a que
 * terminen y las nuevas lo esperan a el. Sin esto, una operacion que leyo
 * «abierta» justo antes del cierre grabaria despues un movimiento que la foto
 * ya no ve.
 */
export async function exigirGestionAbierta(
  tx: Prisma.TransactionClient,
  almacenId: number,
  gestiones: number[],
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${CLAVE_CIERRE}::int, ${almacenId}::int)`;

  const ultima = await ultimaGestionCerrada(tx, almacenId);
  if (ultima == null) return;

  const cerrada = gestiones.find((g) => g <= ultima);
  if (cerrada === undefined) return;

  const almacen = await tx.almacen.findUnique({
    where: { id: almacenId },
    select: { nombre: true },
  });
  throw new ConflictException(
    `La gestión ${cerrada} del almacén ${almacen?.nombre ?? almacenId} está cerrada: ` +
      'no se puede registrar, anular ni modificar nada de esa gestión.',
  );
}

/** Lock EXCLUSIVO del almacen para ejecutar su cierre de gestion. */
export async function bloquearCierre(
  tx: Prisma.TransactionClient,
  almacenId: number,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAVE_CIERRE}::int, ${almacenId}::int)`;
}

/** La ultima gestion cerrada del almacen, o null si nunca cerro ninguna. */
export async function ultimaGestionCerrada(
  tx: Prisma.TransactionClient,
  almacenId: number,
): Promise<number | null> {
  const agg = await tx.cierreGestion.aggregate({
    _max: { gestion: true },
    where: { almacenId },
  });
  return agg._max.gestion;
}
