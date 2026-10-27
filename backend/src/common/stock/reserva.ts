import type { Prisma } from '../../generated/prisma/client';
import { EstadoEgreso } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Horas que un pedido PENDIENTE DE ENVIO retiene el stock que pidio.
 * Regla del encargado (2026-07-29): el solicitante tiene 48 h para enviar el
 * pedido al aprobador; pasadas esas, el material vuelve a estar disponible.
 *
 * Son horas CORRIDAS (confirmado el 2026-10-27): un pedido creado el viernes a
 * la tarde vence el domingo.
 *
 * El reloj corre SOLO mientras el pedido esta en manos del solicitante, desde
 * `Egreso.reservaDesde`: se pone al crear, al rechazar (48 h nuevas para
 * corregir) y al volver a elegir items tras un vencimiento. Enviado, el reloj
 * no corre — si el aprobador o el almacen tardan, no es culpa del solicitante.
 *
 * Al vencer, el pedido se VACIA: se le quitan las lineas y el solicitante tiene
 * que volver a elegir lo que necesita (`EgresosService.vaciarSiVencio`).
 */
export const HORAS_RESERVA_BORRADOR = 48;

const MS_RESERVA = HORAS_RESERVA_BORRADOR * 60 * 60 * 1000;

/** Hasta cuando reserva un pedido pendiente de envio. */
export function vencimientoReserva(reservaDesde: Date): Date {
  return new Date(reservaDesde.getTime() + MS_RESERVA);
}

/**
 * Lo que tenga `reservaDesde` hasta este instante (inclusive) ya vencio. Es el
 * mismo corte que usa `egresoReservaWhere` (que reserva solo lo POSTERIOR), asi
 * que un pedido nunca esta a la vez reservando y vencido.
 */
export function limiteReserva(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - MS_RESERVA);
}

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
  const limite = limiteReserva(ahora);
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
      { estado: EstadoEgreso.BORRADOR, reservaDesde: { gt: limite } },
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
 *
 * Acepta una transaccion (`tx`) ademas del cliente: los egresos la llaman
 * DESPUES de bloquear los lotes, dentro de la misma transaccion, para que lo que
 * cuenta como reservado no pueda cambiar entre la validacion y la grabacion.
 */
export async function reservadoPorLote(
  prisma: PrismaService | Prisma.TransactionClient,
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
