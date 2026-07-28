import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { almacenesPermitidos } from '../../common/scope/almacenes-permitidos';
import { TipoMovimiento } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { QueryKardexDto } from './dto/query-kardex.dto';

/**
 * Kardex: el libro de movimientos de un item en un almacen, con saldo corriente.
 *
 * No hay tabla de saldos que consultar — el saldo de cada renglon se calcula
 * acumulando los movimientos, que es justamente lo que permite auditarlo. Del
 * sistema anterior se toma la idea (su kardex tambien se armaba al vuelo) pero
 * no la limitacion: alla hay que elegir SI o SI una fuente de financiamiento,
 * aca sin filtro salen todas juntas.
 */
@Injectable()
export class KardexService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cuanto suma o resta un movimiento al saldo.
   *
   * ENTRADA suma y SALIDA resta, claro. La REVERSION depende de QUE revierte:
   * la de un ingreso deshace una entrada (resta) y la de un egreso devolvera
   * material (sumara). Por eso el signo sale del documento de origen y no del
   * tipo — cuando existan egresos, esta funcion es el unico lugar a tocar.
   */
  private signo(movimiento: {
    tipo: TipoMovimiento;
    ingresoId: number | null;
  }): 1 | -1 {
    if (movimiento.tipo === TipoMovimiento.ENTRADA) return 1;
    if (movimiento.tipo === TipoMovimiento.SALIDA) return -1;
    return movimiento.ingresoId != null ? -1 : 1;
  }

  async findAll(query: QueryKardexDto, user: AuthenticatedUser) {
    const almacenId = await this.resolverAlmacen(query.almacenId, user);
    const gestion = query.gestion ?? new Date().getFullYear();

    const item = await this.prisma.item.findUnique({
      where: { id: query.itemId },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
        partida: { select: { id: true, codigo: true, denominacion: true } },
      },
    });
    if (!item) throw new NotFoundException('No existe el ítem');

    const almacen = await this.prisma.almacen.findUnique({
      where: { id: almacenId },
      select: { id: true, nombre: true },
    });
    if (!almacen) throw new NotFoundException('No existe el almacén');

    // La fuente cuelga del LOTE (el ingreso que trajo el material), no del
    // movimiento: sirve igual para las entradas de hoy y para las salidas que
    // vendran, porque ambas apuntan al lote del que salen.
    const filtroFuente = query.fuenteFinanciamientoId
      ? {
          ingresoDetalle: {
            ingreso: {
              fuenteFinanciamientoId: query.fuenteFinanciamientoId,
            },
          },
        }
      : {};

    const base = { itemId: item.id, almacenId, ...filtroFuente };
    const inicio = new Date(Date.UTC(gestion, 0, 1));
    const fin = new Date(Date.UTC(gestion + 1, 0, 1));

    const seleccion = {
      id: true,
      tipo: true,
      fecha: true,
      cantidad: true,
      precioUnitario: true,
      motivo: true,
      ingresoId: true,
      ingreso: {
        select: { id: true, numero: true, gestion: true },
      },
      ingresoDetalle: {
        select: {
          id: true,
          ingreso: {
            select: {
              fuenteFinanciamiento: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    } as const;

    const [anteriores, movimientos] = await Promise.all([
      // Saldo de apertura: todo lo anterior a la gestion pedida.
      this.prisma.movimientoKardex.findMany({
        where: { ...base, fecha: { lt: inicio } },
        select: { tipo: true, cantidad: true, ingresoId: true },
      }),
      this.prisma.movimientoKardex.findMany({
        where: { ...base, fecha: { gte: inicio, lt: fin } },
        select: seleccion,
        // Por fecha y, a igual fecha, por id: el orden de registro. Sin el
        // desempate el saldo corriente podria salir en otro orden cada vez.
        orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const saldoInicial = anteriores.reduce(
      (suma, m) => suma + this.signo(m) * Number(m.cantidad),
      0,
    );

    let saldo = saldoInicial;
    const filas = movimientos.map((m) => {
      const cantidad = Number(m.cantidad);
      const signo = this.signo(m);
      saldo += signo * cantidad;
      return {
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        motivo: m.motivo,
        // El documento que lo origino, ya formateado como se imprime.
        documento:
          m.ingreso?.numero != null && m.ingreso.gestion != null
            ? `${String(m.ingreso.numero).padStart(3, '0')}/${m.ingreso.gestion}`
            : null,
        ingresoId: m.ingresoId,
        fuente: m.ingresoDetalle?.ingreso.fuenteFinanciamiento ?? null,
        precioUnitario: m.precioUnitario,
        entrada: signo > 0 ? cantidad : null,
        salida: signo < 0 ? cantidad : null,
        saldo,
      };
    });

    return {
      item,
      almacen,
      gestion,
      saldoInicial,
      saldoFinal: saldo,
      movimientos: filas,
    };
  }

  /** El responsable usa su almacen; los demas tienen que decir cual. */
  private async resolverAlmacen(
    almacenId: number | undefined,
    user: AuthenticatedUser,
  ): Promise<number> {
    const permitidos = await almacenesPermitidos(this.prisma, user);

    if (permitidos === null) {
      if (!almacenId) {
        throw new BadRequestException(
          'Elegí el almacén: el kardex es de un ítem en un almacén',
        );
      }
      return almacenId;
    }

    if (permitidos.length === 0) {
      throw new BadRequestException('No tenés ningún almacén asignado');
    }
    // Con scope propio: si pide uno, tiene que estar entre los suyos.
    if (almacenId) {
      if (!permitidos.includes(almacenId)) {
        throw new NotFoundException('No existe el almacén');
      }
      return almacenId;
    }
    return permitidos[0];
  }
}
