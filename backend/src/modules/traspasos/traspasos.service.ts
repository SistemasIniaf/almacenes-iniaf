import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { bloquearSerie } from '../../common/correlativo/bloquear-serie';
import { paginated } from '../../common/dto/paginated-result';
import { gestionDe } from '../../common/fechas/zona-horaria';
import { almacenesPermitidos } from '../../common/scope/almacenes-permitidos';
import { reservadoPorLote } from '../../common/stock/reserva';
import type { Prisma } from '../../generated/prisma/client';
import { EstadoIngreso, TipoMovimiento } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateTraspasoDto } from './dto/create-traspaso.dto';
import { QueryTraspasosDto } from './dto/query-traspasos.dto';

/**
 * Un traspaso de muchos lotes (el cierre de un almacen entero) son varios miles
 * de escrituras en UNA transaccion: los 5 s por defecto de Prisma no alcanzan.
 */
const TIMEOUT_TRANSACCION_MS = 5 * 60 * 1000;

/** El lote tal como lo necesita la pantalla del traspaso y su ficha. */
const loteSelect = {
  id: true,
  cantidad: true,
  precioUnitario: true,
  saldoCantidad: true,
  observacion: true,
  item: {
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      unidadMedida: true,
      partida: { select: { id: true, codigo: true } },
    },
  },
  ingreso: {
    select: {
      id: true,
      numero: true,
      gestion: true,
      fechaIngreso: true,
      fuenteFinanciamiento: { select: { id: true, nombre: true } },
      proveedor: { select: { id: true, nombre: true } },
      // Si el lote ya habia llegado por otro traspaso, su «documento» es ese.
      traspaso: { select: { id: true, numero: true, gestion: true } },
    },
  },
} as const;

const listSelect = {
  id: true,
  numero: true,
  gestion: true,
  fecha: true,
  observacion: true,
  almacenOrigen: { select: { id: true, nombre: true } },
  almacenDestino: { select: { id: true, nombre: true } },
  registradoPor: { select: { id: true, nombre: true } },
  detalles: {
    select: {
      cantidad: true,
      loteOrigen: { select: { precioUnitario: true } },
    },
  },
} as const;

/**
 * TRASPASOS entre almacenes (2026-10-29, version minima).
 *
 * El caso que lo motivo es el CIERRE de un almacen: pasar uno, varios o todos
 * sus lotes a otro. Inmediato (sin aprobacion ni confirmacion de recepcion),
 * solo el super_admin, sin anulacion — lo demas se agrega si el encargado lo
 * pide.
 *
 * Como queda en la base, por cada linea:
 *   - el lote de ORIGEN baja su saldo y su almacen registra una SALIDA;
 *   - en el DESTINO nace un lote NUEVO con el mismo item, precio, fuente y
 *     observacion, y una ENTRADA en su kardex.
 *
 * El lote nuevo necesita un `Ingreso` que le de almacen, fuente y fecha — asi
 * stock, egresos, kardex y reportes lo tratan como a cualquier otro, sin saber
 * nada de traspasos. Ese ingreso es un PORTADOR (`Ingreso.traspasoId`): uno por
 * cada ingreso de origen, con sus respaldos copiados (proveedor, C31,
 * factura...), sin numero propio y fuera del listado de ingresos. El documento
 * es el traspaso.
 */
@Injectable()
export class TraspasosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  /** Un traspaso es visible si el usuario ve su origen O su destino. */
  private async whereScope(
    user: AuthenticatedUser,
    almacenId?: number,
  ): Promise<Prisma.TraspasoWhereInput> {
    const scope = await almacenesPermitidos(this.prisma, user);
    const ids =
      scope === null
        ? almacenId
          ? [almacenId]
          : null
        : almacenId
          ? scope.filter((id) => id === almacenId)
          : scope;
    if (ids === null) return {};
    return {
      OR: [{ almacenOrigenId: { in: ids } }, { almacenDestinoId: { in: ids } }],
    };
  }

  async findAll(query: QueryTraspasosDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.TraspasoWhereInput = {
      ...(await this.whereScope(user, query.almacenId)),
      ...(query.gestion ? { gestion: query.gestion } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.traspaso.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.traspaso.count({ where }),
    ]);

    const filas = data.map(({ detalles, ...t }) => ({
      ...t,
      lineas: detalles.length,
      total: detalles.reduce(
        (s, d) => s + Number(d.cantidad) * Number(d.loteOrigen.precioUnitario),
        0,
      ),
    }));
    return paginated(filas, total, page, pageSize);
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const traspaso = await this.prisma.traspaso.findFirst({
      where: { id, ...(await this.whereScope(user)) },
      select: {
        id: true,
        numero: true,
        gestion: true,
        fecha: true,
        observacion: true,
        createdAt: true,
        almacenOrigen: { select: { id: true, nombre: true } },
        almacenDestino: { select: { id: true, nombre: true } },
        registradoPor: { select: { id: true, nombre: true, cargo: true } },
        detalles: {
          select: {
            id: true,
            cantidad: true,
            loteOrigen: { select: loteSelect },
            loteDestinoId: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!traspaso) throw new NotFoundException('No existe el traspaso');
    return traspaso;
  }

  /**
   * Todos los lotes con saldo de un almacen, con lo reservado por pedidos y el
   * disponible. Sin paginar a proposito: el caso principal es «pasar todo», y
   * la pantalla necesita la lista entera para elegir y para el total.
   *
   * Se incluyen tambien los que estan reservados ENTEROS (disponible 0): no se
   * pueden traspasar, pero el que cierra el almacen tiene que ver que hay
   * pedidos en curso que resolver antes.
   */
  async lotesDisponibles(almacenId: number) {
    const lotes = await this.prisma.ingresoDetalle.findMany({
      where: {
        saldoCantidad: { gt: 0 },
        ingreso: { almacenId, estado: EstadoIngreso.CONFIRMADO },
      },
      select: loteSelect,
      orderBy: [
        { item: { partida: { codigo: 'asc' } } },
        { item: { descripcion: 'asc' } },
        { ingreso: { fechaIngreso: 'asc' } },
        { id: 'asc' },
      ],
    });
    const reservado = await reservadoPorLote(
      this.prisma,
      lotes.map((l) => l.id),
    );
    return lotes.map((l) => {
      const enReserva = reservado.get(l.id) ?? 0;
      return {
        ...l,
        reservado: enReserva,
        disponible: Number(l.saldoCantidad) - enReserva,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Registrar
  // ---------------------------------------------------------------------------

  async create(dto: CreateTraspasoDto, user: AuthenticatedUser) {
    if (dto.almacenOrigenId === dto.almacenDestinoId) {
      throw new BadRequestException(
        'El almacén de destino tiene que ser distinto del de origen',
      );
    }
    const [origen, destino] = await Promise.all([
      this.prisma.almacen.findUnique({ where: { id: dto.almacenOrigenId } }),
      this.prisma.almacen.findUnique({ where: { id: dto.almacenDestinoId } }),
    ]);
    if (!origen) throw new NotFoundException('No existe el almacén de origen');
    if (!destino) {
      throw new NotFoundException('No existe el almacén de destino');
    }
    // El origen puede estar dado de baja: es justo el caso del cierre. El
    // destino no, porque el material quedaria donde nadie puede sacarlo.
    if (!destino.activo) {
      throw new BadRequestException('El almacén de destino está dado de baja');
    }

    const ids = dto.detalles.map((d) => d.ingresoDetalleId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Un mismo lote no puede ir en dos líneas del traspaso',
      );
    }

    const fecha = new Date();
    const gestion = gestionDe(fecha);
    const observacion = dto.observacion.trim().toUpperCase();

    const id = await this.prisma.$transaction(
      async (tx) => {
        // Mismo bloqueo y mismo orden que los egresos (`bloquearLotes`): un
        // pedido que reserva este lote en este instante, o entra antes y se ve
        // en la reserva, o espera y encuentra el saldo ya descontado.
        await tx.$queryRawUnsafe(
          `SELECT id FROM ingreso_detalles WHERE id IN (${[...ids]
            .sort((a, b) => a - b)
            .join(',')}) ORDER BY id FOR UPDATE`,
        );

        const lotes = await tx.ingresoDetalle.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            itemId: true,
            precioUnitario: true,
            saldoCantidad: true,
            observacion: true,
            item: { select: { codigo: true, descripcion: true } },
            ingreso: {
              select: {
                id: true,
                estado: true,
                almacenId: true,
                fuenteFinanciamientoId: true,
                proveedorId: true,
                fechaRemision: true,
                notaRemision: true,
                procesoC31: true,
                certificacion: true,
                informeConformidad: true,
                fechaInformeConformidad: true,
                numeroFactura: true,
                observacion: true,
                responsableConformidadId: true,
                unidadSolicitanteId: true,
              },
            },
          },
        });
        const porId = new Map(lotes.map((l) => [l.id, l]));

        // Leido DESPUES del bloqueo: la misma regla de disponible que usan el
        // stock y los egresos. Un traspaso nunca se lleva material que un
        // pedido ya tiene comprometido.
        const reservado = await reservadoPorLote(tx, ids);
        const problemas: string[] = [];
        for (const d of dto.detalles) {
          const lote = porId.get(d.ingresoDetalleId);
          if (
            !lote ||
            lote.ingreso.almacenId !== dto.almacenOrigenId ||
            lote.ingreso.estado !== EstadoIngreso.CONFIRMADO
          ) {
            problemas.push(
              `el lote ${d.ingresoDetalleId} no es del almacén de origen`,
            );
            continue;
          }
          const disponible =
            Number(lote.saldoCantidad) - (reservado.get(lote.id) ?? 0);
          if (d.cantidad > disponible) {
            problemas.push(
              `${lote.item.codigo} ${lote.item.descripcion}: pide ${d.cantidad} y hay ${disponible} disponible`,
            );
          }
        }
        if (problemas.length) {
          throw new ConflictException(
            `No se puede traspasar: ${problemas.slice(0, 5).join('; ')}${
              problemas.length > 5 ? ` (y ${problemas.length - 5} más)` : ''
            }.`,
          );
        }

        await bloquearSerie(tx, 'traspasos', dto.almacenOrigenId);
        const agg = await tx.traspaso.aggregate({
          _max: { numero: true },
          where: { almacenOrigenId: dto.almacenOrigenId, gestion },
        });
        const traspaso = await tx.traspaso.create({
          data: {
            numero: (agg._max.numero ?? 0) + 1,
            gestion,
            almacenOrigenId: dto.almacenOrigenId,
            almacenDestinoId: dto.almacenDestinoId,
            fecha,
            observacion,
            registradoPorId: user.id,
          },
          select: { id: true },
        });

        // Un portador por cada ingreso de origen, con sus respaldos: el lote
        // nuevo sigue diciendo de que compra viene.
        const portadores = new Map<number, number>();
        for (const lote of lotes) {
          const ing = lote.ingreso;
          if (portadores.has(ing.id)) continue;
          const {
            id: ingresoOrigenId,
            estado: _e,
            almacenId: _a,
            ...copia
          } = ing;
          const portador = await tx.ingreso.create({
            data: {
              ...copia,
              estado: EstadoIngreso.CONFIRMADO,
              gestion,
              fechaIngreso: fecha,
              almacenId: dto.almacenDestinoId,
              registradoPorId: user.id,
              traspasoId: traspaso.id,
            },
            select: { id: true },
          });
          portadores.set(ingresoOrigenId, portador.id);
        }

        const motivoSalida = `TRASPASO AL ALMACÉN ${destino.nombre}`;
        const motivoEntrada = `TRASPASO DESDE EL ALMACÉN ${origen.nombre}`;
        const movimientos: Prisma.MovimientoKardexCreateManyInput[] = [];
        const detalles: Prisma.TraspasoDetalleCreateManyInput[] = [];

        for (const d of dto.detalles) {
          const lote = porId.get(d.ingresoDetalleId)!;

          // Condicional, como la entrega de un egreso: la base garantiza que
          // el saldo no quede negativo.
          const { count } = await tx.ingresoDetalle.updateMany({
            where: { id: lote.id, saldoCantidad: { gte: d.cantidad } },
            data: { saldoCantidad: { decrement: d.cantidad } },
          });
          if (count !== 1) {
            throw new ConflictException(
              `El saldo de ${lote.item.descripcion} cambió mientras tanto: volvé a cargar la lista`,
            );
          }

          const nuevo = await tx.ingresoDetalle.create({
            data: {
              ingresoId: portadores.get(lote.ingreso.id)!,
              itemId: lote.itemId,
              cantidad: d.cantidad,
              precioUnitario: lote.precioUnitario,
              saldoCantidad: d.cantidad,
              observacion: lote.observacion,
            },
            select: { id: true },
          });

          detalles.push({
            traspasoId: traspaso.id,
            loteOrigenId: lote.id,
            loteDestinoId: nuevo.id,
            cantidad: d.cantidad,
          });
          movimientos.push(
            {
              tipo: TipoMovimiento.SALIDA,
              itemId: lote.itemId,
              almacenId: dto.almacenOrigenId,
              cantidad: d.cantidad,
              precioUnitario: lote.precioUnitario,
              ingresoDetalleId: lote.id,
              traspasoId: traspaso.id,
              fecha,
              motivo: motivoSalida,
            },
            {
              tipo: TipoMovimiento.ENTRADA,
              itemId: lote.itemId,
              almacenId: dto.almacenDestinoId,
              cantidad: d.cantidad,
              precioUnitario: lote.precioUnitario,
              ingresoId: portadores.get(lote.ingreso.id)!,
              ingresoDetalleId: nuevo.id,
              traspasoId: traspaso.id,
              fecha,
              motivo: motivoEntrada,
            },
          );
        }

        await tx.traspasoDetalle.createMany({ data: detalles });
        await tx.movimientoKardex.createMany({ data: movimientos });
        return traspaso.id;
      },
      { timeout: TIMEOUT_TRANSACCION_MS, maxWait: 10_000 },
    );

    return this.findOne(id, user);
  }
}
