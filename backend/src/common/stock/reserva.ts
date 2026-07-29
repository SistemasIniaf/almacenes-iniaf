import { EstadoEgreso } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Horas que un BORRADOR retiene el stock que pidio antes de soltarlo.
 * Regla del encargado (2026-07-29): el solicitante tiene 48 h para enviar el
 * pedido al aprobador; pasadas esas, el material vuelve a estar disponible.
 *
 * Son horas CORRIDAS: un borrador creado el viernes a la tarde vence el domingo.
 */
export const HORAS_RESERVA_BORRADOR = 48;

/**
 * Que egresos retienen stock.
 *
 * La reserva NO es una columna: se DERIVA de las lineas cuyo egreso esta en un
 * estado que retiene. Asi no puede desincronizarse — la leccion de
 * `SALDOCANTIDAD` del sistema anterior, desincronizado en el 59% de los lotes
 * por mantenerse a mano.
 *
 * Y por eso el vencimiento del borrador es una CONDICION de la consulta y no un
 * proceso en segundo plano: un cron que falla deja stock reservado fantasma que
 * nadie puede liberar.
 *
 * ENTREGADO y ANULADO no reservan: el entregado ya se descargo del saldo del
 * lote (contarlo seria contarlo dos veces) y el anulado se devolvio.
 */
export function egresoReservaWhere(ahora: Date = new Date()) {
  const limite = new Date(
    ahora.getTime() - HORAS_RESERVA_BORRADOR * 60 * 60 * 1000,
  );
  return {
    OR: [
      {
        estado: {
          in: [
            EstadoEgreso.PENDIENTE_APROBADOR,
            EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
          ],
        },
      },
      { estado: EstadoEgreso.BORRADOR, createdAt: { gt: limite } },
    ],
  };
}

/**
 * Cuanto hay reservado de cada lote, como `Map<ingresoDetalleId, cantidad>`.
 * Un lote que no aparece en el mapa no tiene nada reservado.
 *
 * `excluirEgresoId` saca de la cuenta al propio pedido que se esta validando:
 * al editar sus lineas, lo que el mismo ya tenia reservado no debe competir
 * contra el.
 */
export async function reservadoPorLote(
  prisma: PrismaService,
  loteIds: number[],
  opciones?: { excluirEgresoId?: number },
): Promise<Map<number, number>> {
  if (loteIds.length === 0) return new Map();

  const filas = await prisma.egresoDetalle.groupBy({
    by: ['ingresoDetalleId'],
    where: {
      ingresoDetalleId: { in: loteIds },
      egreso: {
        ...egresoReservaWhere(),
        ...(opciones?.excluirEgresoId
          ? { id: { not: opciones.excluirEgresoId } }
          : {}),
      },
    },
    _sum: { cantidadSolicitada: true },
  });

  return new Map(
    filas.map((f) => [
      f.ingresoDetalleId,
      Number(f._sum.cantidadSolicitada ?? 0),
    ]),
  );
}
