import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { almacenesPermitidos } from '../../common/scope/almacenes-permitidos';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { reservadoPorLote } from '../../common/stock/reserva';
import {
  EstadoEgreso,
  Rol,
  TipoMovimiento,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateEgresoDto, EgresoDetalleDto } from './dto/create-egreso.dto';
import { EntregarEgresoDto } from './dto/entregar-egreso.dto';
import { MotivoDto } from './dto/decision-egreso.dto';
import { QueryEgresosDto } from './dto/query-egresos.dto';
import { UpdateEgresoDto } from './dto/update-egreso.dto';

/**
 * Rango de fechas del listado de egresos.
 *
 * El egreso tiene TRES fechas y el filtro usa la MISMA que muestra la columna
 * «Fecha» de la pantalla: `fechaEnvio` (cuando entro al circuito y se volvio un
 * documento) y, mientras es borrador y no la tiene, `createdAt`. Filtrar por
 * otra haria que la tabla escondiera filas cuya fecha visible cae dentro del
 * rango.
 *
 * Ambos extremos INCLUSIVOS: `hasta` se lleva al dia siguiente y se compara con
 * `lt`, porque la fecha guardada tiene hora. En UTC, igual que el kardex.
 */
function rangoFechaEgreso(desde?: string, hasta?: string) {
  if (!desde && !hasta) return {};

  const aUtc = (valor: string, sumarDias = 0) => {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia + sumarDias));
  };

  const entre = {
    ...(desde ? { gte: aUtc(desde) } : {}),
    ...(hasta ? { lt: aUtc(hasta, 1) } : {}),
  };

  return {
    OR: [{ fechaEnvio: entre }, { fechaEnvio: null, createdAt: entre }],
  };
}

const egresoListSelect = {
  id: true,
  estado: true,
  numero: true,
  gestion: true,
  almacenId: true,
  unidadId: true,
  justificacion: true,
  fechaEnvio: true,
  fechaEntrega: true,
  createdAt: true,
  almacen: { select: { id: true, nombre: true } },
  unidad: { select: { id: true, nombre: true, sigla: true } },
  solicitante: { select: { id: true, nombre: true } },
  _count: { select: { detalles: true } },
} as const;

// El lote trae todo lo que la linea NO repite: item, fuente y precio.
const loteSelect = {
  id: true,
  precioUnitario: true,
  saldoCantidad: true,
  item: {
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      unidadMedida: true,
      // La foto de catalogo: el formulario la muestra junto a la linea, para
      // reconocer el material sin depender de la descripcion.
      imagenUrl: true,
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
    },
  },
} as const;

const egresoFullSelect = {
  ...egresoListSelect,
  entregadoPorId: true,
  anuladoPorId: true,
  anuladoEn: true,
  motivoAnulacion: true,
  updatedAt: true,
  solicitante: {
    select: { id: true, nombre: true, cargo: true, usuario: true },
  },
  entregadoPor: { select: { id: true, nombre: true, cargo: true } },
  anuladoPor: { select: { id: true, nombre: true } },
  detalles: {
    select: {
      id: true,
      ingresoDetalleId: true,
      cantidadSolicitada: true,
      cantidadEntregada: true,
      ingresoDetalle: { select: loteSelect },
    },
    orderBy: { id: 'asc' },
  },
  historial: {
    select: {
      id: true,
      estadoAnterior: true,
      estadoNuevo: true,
      motivo: true,
      createdAt: true,
      usuario: { select: { id: true, nombre: true } },
    },
    orderBy: { id: 'asc' },
  },
} as const;

@Injectable()
export class EgresosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  /**
   * `where` del listado, compartido con el reporte imprimible: los dos tienen
   * que responder a los MISMOS filtros o el papel no coincidiria con lo que se
   * ve en pantalla.
   *
   * Va con `AND` explicito y NO con spreads sobre un mismo objeto. El alcance
   * del rol trae `almacenId` (responsable/observador) o `unidadId` (aprobador),
   * y un spread posterior con la misma clave lo PISA: mandar `?almacenId=2` le
   * mostraba al responsable los egresos de otro almacen. Con `AND` las dos
   * condiciones se exigen juntas y el filtro solo puede acotar.
   */
  private async armarWhere(query: QueryEgresosDto, user: AuthenticatedUser) {
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'egresos',
          ['justificacion'],
          query.q,
        )
      : null;

    return {
      AND: [
        await this.alcance(user),
        {
          ...(query.estado ? { estado: query.estado } : {}),
          ...(query.gestion ? { gestion: query.gestion } : {}),
          ...(query.unidadId ? { unidadId: query.unidadId } : {}),
          ...(query.almacenId ? { almacenId: query.almacenId } : {}),
          ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
        },
        query.pendientesMios ? this.filtroBandeja(user) : {},
        rangoFechaEgreso(query.desde, query.hasta),
      ],
    };
  }

  async findAll(query: QueryEgresosDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = await this.armarWhere(query, user);

    const [data, total] = await Promise.all([
      this.prisma.egreso.findMany({
        where,
        select: egresoListSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.egreso.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  /**
   * Los egresos del rango, SIN paginar, para el reporte imprimible. Hermano de
   * `IngresosService.reporte`.
   *
   * Orden CRONOLOGICO ascendente: en el papel se lee como un libro, no como una
   * bandeja de novedades.
   *
   * El valor de cada pedido sale de `cantidadEntregada ?? cantidadSolicitada`
   * por el precio de SU lote: lo entregado si ya salio y lo pedido mientras
   * espera. Por eso la fila lleva el estado — un pendiente vale lo que se
   * estima, no lo que salio del almacen.
   */
  async reporte(query: QueryEgresosDto, user: AuthenticatedUser) {
    const where = await this.armarWhere(query, user);

    const egresos = await this.prisma.egreso.findMany({
      where,
      select: {
        id: true,
        estado: true,
        numero: true,
        gestion: true,
        fechaEnvio: true,
        fechaEntrega: true,
        justificacion: true,
        createdAt: true,
        almacen: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, sigla: true } },
        solicitante: { select: { id: true, nombre: true } },
        detalles: {
          select: {
            cantidadSolicitada: true,
            cantidadEntregada: true,
            // El precio de la salida sale del LOTE: la linea no lo repite.
            ingresoDetalle: { select: { precioUnitario: true } },
          },
        },
      },
      orderBy: [{ fechaEnvio: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return egresos.map(({ detalles, ...egreso }) => ({
      ...egreso,
      items: detalles.length,
      total: detalles
        .reduce(
          (suma, d) =>
            suma +
            Number(d.cantidadEntregada ?? d.cantidadSolicitada) *
              Number(d.ingresoDetalle.precioUnitario),
          0,
        )
        .toFixed(2),
    }));
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const egreso = await this.prisma.egreso.findFirst({
      where: { id, ...(await this.alcance(user)) },
      select: egresoFullSelect,
    });
    if (!egreso) {
      throw new NotFoundException(`No existe el egreso con id ${id}`);
    }
    return egreso;
  }

  // ---------------------------------------------------------------------------
  // Borrador: crear, editar, descartar
  // ---------------------------------------------------------------------------

  /**
   * Crea el pedido como BORRADOR. El almacen y la unidad NO se eligen: son los
   * del solicitante. Reserva stock desde este momento y por 48 h (ver
   * `common/stock/reserva.ts`).
   */
  async create(dto: CreateEgresoDto, user: AuthenticatedUser) {
    if (user.rol !== Rol.solicitador) {
      throw new ForbiddenException('Solo un solicitador puede pedir material');
    }
    if (user.unidadId == null || user.almacenId == null) {
      throw new BadRequestException(
        'Tu usuario no tiene unidad o almacen asignados: avisá al administrador',
      );
    }

    const almacenId = user.almacenId;
    await this.validarDisponibilidad(dto.detalles, almacenId);

    const id = await this.prisma.$transaction(async (tx) => {
      await this.bloquearLotes(tx, dto.detalles);

      const egreso = await tx.egreso.create({
        data: {
          estado: EstadoEgreso.BORRADOR,
          almacenId,
          unidadId: user.unidadId as number,
          solicitanteId: user.id,
          justificacion: dto.justificacion.trim(),
          detalles: { create: dto.detalles.map((d) => this.datosLinea(d)) },
        },
        select: { id: true },
      });

      await this.registrarHistorial(
        tx,
        egreso.id,
        null,
        EstadoEgreso.BORRADOR,
        user,
      );
      return egreso.id;
    });

    return this.findOne(id, user);
  }

  /** Edita el borrador. Si vienen `detalles`, reemplazan la lista completa. */
  async update(id: number, dto: UpdateEgresoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, EstadoEgreso.BORRADOR);
    this.exigirSolicitante(egreso.solicitanteId, user);

    if (dto.detalles) {
      // El propio pedido se excluye del calculo: lo que el ya tenia reservado no
      // puede competir contra el mismo.
      await this.validarDisponibilidad(dto.detalles, egreso.almacenId, id);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.detalles) {
        await this.bloquearLotes(tx, dto.detalles);
        await tx.egresoDetalle.deleteMany({ where: { egresoId: id } });
        await tx.egresoDetalle.createMany({
          data: dto.detalles.map((d) => ({
            egresoId: id,
            ...this.datosLinea(d),
          })),
        });
      }
      await tx.egreso.update({
        where: { id },
        data: {
          ...(dto.justificacion !== undefined
            ? { justificacion: dto.justificacion.trim() }
            : {}),
        },
      });
    });

    return this.findOne(id, user);
  }

  /**
   * Descarta un borrador. Se borra de verdad, a diferencia de un ingreso o de un
   * egreso ya enviado: un borrador todavia NO es un documento (no tiene numero) y
   * no toco stock. Dejarlo como "anulado" solo ensuciaria el listado y seguiria
   * apareciendo en el historial de nadie.
   */
  async remove(id: number, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, EstadoEgreso.BORRADOR);
    this.exigirSolicitante(egreso.solicitanteId, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.egresoHistorial.deleteMany({ where: { egresoId: id } });
      await tx.egresoDetalle.deleteMany({ where: { egresoId: id } });
      await tx.egreso.delete({ where: { id } });
    });

    return { id, eliminado: true };
  }

  // ---------------------------------------------------------------------------
  // Circuito
  // ---------------------------------------------------------------------------

  /**
   * Envia el pedido al jefe de unidad. Aca el pedido se vuelve DOCUMENTO: recien
   * ahora se estampa el correlativo, para que un borrador descartado no deje un
   * hueco en la serie.
   *
   * Se re-valida la disponibilidad: entre que se armo el borrador y este momento
   * pudo vencer su reserva de 48 h y otro pedido pudo tomar el saldo.
   */
  async enviar(id: number, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, EstadoEgreso.BORRADOR);
    this.exigirSolicitante(egreso.solicitanteId, user);

    const detalles = await this.prisma.egresoDetalle.findMany({
      where: { egresoId: id },
      select: { ingresoDetalleId: true, cantidadSolicitada: true },
    });
    if (detalles.length === 0) {
      throw new BadRequestException('El pedido no tiene ítems');
    }

    const lineas = detalles.map((d) => ({
      ingresoDetalleId: d.ingresoDetalleId,
      cantidadSolicitada: Number(d.cantidadSolicitada),
    }));
    await this.validarDisponibilidad(lineas, egreso.almacenId, id);

    await this.prisma.$transaction(async (tx) => {
      await this.bloquearLotes(tx, lineas);

      const fechaEnvio = new Date();
      const gestion = fechaEnvio.getFullYear();
      const agg = await tx.egreso.aggregate({
        _max: { numero: true },
        where: { almacenId: egreso.almacenId, gestion },
      });

      await tx.egreso.update({
        where: { id },
        data: {
          estado: EstadoEgreso.PENDIENTE_APROBADOR,
          numero: (agg._max.numero ?? 0) + 1,
          gestion,
          fechaEnvio,
        },
      });
      await this.registrarHistorial(
        tx,
        id,
        EstadoEgreso.BORRADOR,
        EstadoEgreso.PENDIENTE_APROBADOR,
        user,
      );
    });

    return this.findOne(id, user);
  }

  /**
   * Aprobacion del jefe de unidad. NO toca cantidades: eso es del responsable de
   * almacen al entregar (regla del encargado, 2026-07-29).
   */
  async aprobar(id: number, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, EstadoEgreso.PENDIENTE_APROBADOR);

    if (user.rol === Rol.aprobador && user.unidadId !== egreso.unidadId) {
      throw new ForbiddenException(
        'Solo podés aprobar pedidos de tu propia unidad',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.egreso.update({
        where: { id },
        data: { estado: EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN },
      });
      await this.registrarHistorial(
        tx,
        id,
        EstadoEgreso.PENDIENTE_APROBADOR,
        EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
        user,
      );
    });

    return this.findOne(id, user);
  }

  /**
   * Rechazo desde cualquiera de los dos niveles. Siempre vuelve al solicitante,
   * nunca al nivel anterior. El motivo es obligatorio: es lo unico que le dice
   * al solicitante que corregir.
   *
   * El rechazo no es un estado — queda en el historial. Y libera la reserva sin
   * hacer nada: al volver a BORRADOR arranca de nuevo la ventana de 48 h.
   */
  async rechazar(id: number, dto: MotivoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    const estadosRechazables: EstadoEgreso[] = [
      EstadoEgreso.PENDIENTE_APROBADOR,
      EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
    ];
    if (!estadosRechazables.includes(egreso.estado)) {
      throw new BadRequestException(
        'Solo se puede rechazar un pedido que está esperando una decisión',
      );
    }
    if (
      egreso.estado === EstadoEgreso.PENDIENTE_APROBADOR &&
      user.rol === Rol.aprobador &&
      user.unidadId !== egreso.unidadId
    ) {
      throw new ForbiddenException(
        'Solo podés rechazar pedidos de tu propia unidad',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.egreso.update({
        where: { id },
        data: { estado: EstadoEgreso.BORRADOR },
      });
      await this.registrarHistorial(
        tx,
        id,
        egreso.estado,
        EstadoEgreso.BORRADOR,
        user,
        dto.motivo.trim(),
      );
    });

    return this.findOne(id, user);
  }

  /**
   * Entrega: descuenta el saldo de cada lote y escribe la SALIDA en el Kardex,
   * valorizada al precio DE ESE LOTE (por eso la linea apunta al lote y no al
   * item).
   *
   * El descuento se hace con un UPDATE condicional (`saldoCantidad >= cantidad`)
   * en vez de leer-y-escribir: es la base de datos la que garantiza que el saldo
   * no quede negativo, que es de donde vienen los saldos rotos del sistema
   * anterior.
   */
  async entregar(id: number, dto: EntregarEgresoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(
      egreso.estado,
      EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
    );

    if (
      user.rol === Rol.responsable_almacen &&
      user.almacenId !== egreso.almacenId
    ) {
      throw new ForbiddenException(
        'Solo podés entregar pedidos de tu propio almacén',
      );
    }

    const detalles = await this.prisma.egresoDetalle.findMany({
      where: { egresoId: id },
      select: {
        id: true,
        ingresoDetalleId: true,
        cantidadSolicitada: true,
        ingresoDetalle: {
          select: {
            id: true,
            precioUnitario: true,
            itemId: true,
            item: { select: { descripcion: true } },
          },
        },
      },
    });

    const porId = new Map(detalles.map((d) => [d.id, d]));
    if (dto.lineas.length !== detalles.length) {
      throw new BadRequestException(
        'Hay que indicar cuánto se entrega de CADA línea del pedido',
      );
    }

    for (const linea of dto.lineas) {
      const detalle = porId.get(linea.detalleId);
      if (!detalle) {
        throw new BadRequestException(
          `La línea ${linea.detalleId} no pertenece a este pedido`,
        );
      }
      if (linea.cantidadEntregada > Number(detalle.cantidadSolicitada)) {
        throw new BadRequestException(
          `No se puede entregar más de lo pedido de "${detalle.ingresoDetalle.item.descripcion}" ` +
            `(pedido: ${Number(detalle.cantidadSolicitada)})`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const linea of dto.lineas) {
        const detalle = porId.get(linea.detalleId) as (typeof detalles)[number];

        await tx.egresoDetalle.update({
          where: { id: detalle.id },
          data: { cantidadEntregada: linea.cantidadEntregada },
        });

        // Entregar cero es valido (negar un item sin rechazar el pedido): no
        // mueve stock ni deja movimiento en el Kardex.
        if (linea.cantidadEntregada === 0) continue;

        const bajado = await tx.ingresoDetalle.updateMany({
          where: {
            id: detalle.ingresoDetalleId,
            saldoCantidad: { gte: linea.cantidadEntregada },
          },
          data: { saldoCantidad: { decrement: linea.cantidadEntregada } },
        });
        if (bajado.count !== 1) {
          throw new ConflictException(
            `El lote de "${detalle.ingresoDetalle.item.descripcion}" ya no tiene saldo suficiente. ` +
              'Ajustá la cantidad a entregar.',
          );
        }

        await tx.movimientoKardex.create({
          data: {
            tipo: TipoMovimiento.SALIDA,
            itemId: detalle.ingresoDetalle.itemId,
            almacenId: egreso.almacenId,
            cantidad: linea.cantidadEntregada,
            precioUnitario: detalle.ingresoDetalle.precioUnitario,
            egresoId: id,
            egresoDetalleId: detalle.id,
            ingresoDetalleId: detalle.ingresoDetalleId,
            fecha: new Date(),
          },
        });
      }

      await tx.egreso.update({
        where: { id },
        data: {
          estado: EstadoEgreso.ENTREGADO,
          fechaEntrega: new Date(),
          entregadoPorId: user.id,
        },
      });
      await this.registrarHistorial(
        tx,
        id,
        EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
        EstadoEgreso.ENTREGADO,
        user,
      );
    });

    return this.findOne(id, user);
  }

  /**
   * Anula un egreso ya entregado: devuelve las cantidades a sus lotes y deja una
   * REVERSION en el Kardex. Mismas reglas que la anulacion del ingreso.
   *
   * OJO: anular dice "esta salida nunca debio existir", NO "el material volvio".
   * Ver docs/decisiones-egresos.md.
   */
  async anular(id: number, dto: MotivoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, EstadoEgreso.ENTREGADO);

    const detalles = await this.prisma.egresoDetalle.findMany({
      where: { egresoId: id },
      select: {
        id: true,
        ingresoDetalleId: true,
        cantidadEntregada: true,
        ingresoDetalle: { select: { itemId: true, precioUnitario: true } },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const d of detalles) {
        const cantidad = Number(d.cantidadEntregada ?? 0);
        if (cantidad === 0) continue;

        await tx.ingresoDetalle.update({
          where: { id: d.ingresoDetalleId },
          data: { saldoCantidad: { increment: cantidad } },
        });
        await tx.movimientoKardex.create({
          data: {
            tipo: TipoMovimiento.REVERSION,
            itemId: d.ingresoDetalle.itemId,
            almacenId: egreso.almacenId,
            cantidad,
            precioUnitario: d.ingresoDetalle.precioUnitario,
            egresoId: id,
            egresoDetalleId: d.id,
            ingresoDetalleId: d.ingresoDetalleId,
            fecha: new Date(),
            motivo: dto.motivo.trim(),
          },
        });
      }

      await tx.egreso.update({
        where: { id },
        data: {
          estado: EstadoEgreso.ANULADO,
          anuladoPorId: user.id,
          anuladoEn: new Date(),
          motivoAnulacion: dto.motivo.trim(),
        },
      });
      await this.registrarHistorial(
        tx,
        id,
        EstadoEgreso.ENTREGADO,
        EstadoEgreso.ANULADO,
        user,
        dto.motivo.trim(),
      );
    });

    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------------------
  // Alcance por rol
  // ---------------------------------------------------------------------------

  /**
   * Que egresos ve cada rol. A diferencia de ingresos/stock, el corte no es solo
   * por almacen: el solicitador ve LOS SUYOS y el aprobador, los de SU UNIDAD.
   */
  private async alcance(user: AuthenticatedUser) {
    if (user.rol === Rol.solicitador) return { solicitanteId: user.id };
    if (user.rol === Rol.aprobador) return { unidadId: user.unidadId ?? -1 };

    const almacenes = await almacenesPermitidos(this.prisma, user);
    return almacenes === null ? {} : { almacenId: { in: almacenes } };
  }

  /** Los que esperan una decisión de ESTE usuario (su bandeja de entrada). */
  private filtroBandeja(user: AuthenticatedUser) {
    if (user.rol === Rol.aprobador) {
      return { estado: EstadoEgreso.PENDIENTE_APROBADOR };
    }
    if (user.rol === Rol.responsable_almacen) {
      return { estado: EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN };
    }
    if (user.rol === Rol.solicitador) {
      return { estado: EstadoEgreso.BORRADOR };
    }
    return {};
  }

  // ---------------------------------------------------------------------------
  // Validaciones y helpers
  // ---------------------------------------------------------------------------

  private async cargarParaEscritura(id: number, user: AuthenticatedUser) {
    const egreso = await this.prisma.egreso.findFirst({
      where: { id, ...(await this.alcance(user)) },
      select: {
        id: true,
        estado: true,
        almacenId: true,
        unidadId: true,
        solicitanteId: true,
        gestion: true,
      },
    });
    if (!egreso) {
      throw new NotFoundException(`No existe el egreso con id ${id}`);
    }
    return egreso;
  }

  private exigirEstado(actual: EstadoEgreso, esperado: EstadoEgreso) {
    if (actual !== esperado) {
      throw new BadRequestException(
        `El pedido está en estado ${actual} y esta acción requiere ${esperado}`,
      );
    }
  }

  private exigirSolicitante(solicitanteId: number, user: AuthenticatedUser) {
    if (user.rol === Rol.solicitador && solicitanteId !== user.id) {
      throw new ForbiddenException('Este pedido no es tuyo');
    }
  }

  /**
   * Cada lote pedido tiene que existir, venir de un ingreso CONFIRMADO de ESTE
   * almacen y tener disponible suficiente. `disponible = saldo - reservado`, no
   * el saldo pelado: si no, dos pedidos podrian llevarse el mismo material.
   */
  private async validarDisponibilidad(
    detalles: { ingresoDetalleId: number; cantidadSolicitada: number }[],
    almacenId: number,
    excluirEgresoId?: number,
  ) {
    const ids = detalles.map((d) => d.ingresoDetalleId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Hay un mismo lote repetido en dos líneas: juntalas en una sola',
      );
    }

    const lotes = await this.prisma.ingresoDetalle.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        saldoCantidad: true,
        item: { select: { descripcion: true } },
        ingreso: { select: { estado: true, almacenId: true } },
      },
    });
    const porId = new Map(lotes.map((l) => [l.id, l]));
    const reservado = await reservadoPorLote(this.prisma, ids, {
      excluirEgresoId,
    });

    for (const d of detalles) {
      const lote = porId.get(d.ingresoDetalleId);
      if (!lote) {
        throw new BadRequestException(
          `El lote ${d.ingresoDetalleId} no existe`,
        );
      }
      if (lote.ingreso.estado !== 'CONFIRMADO') {
        throw new BadRequestException(
          `El lote de "${lote.item.descripcion}" pertenece a un ingreso anulado`,
        );
      }
      if (lote.ingreso.almacenId !== almacenId) {
        throw new BadRequestException(
          `El lote de "${lote.item.descripcion}" no es de tu almacén`,
        );
      }

      const disponible =
        Number(lote.saldoCantidad) - (reservado.get(lote.id) ?? 0);
      if (d.cantidadSolicitada > disponible) {
        throw new ConflictException(
          `No hay disponible suficiente de "${lote.item.descripcion}": ` +
            `pedís ${d.cantidadSolicitada} y hay ${disponible} ` +
            '(el saldo del lote menos lo que ya está reservado por otros pedidos)',
        );
      }
    }
  }

  /**
   * Bloquea las filas de los lotes hasta el fin de la transaccion. Sin esto, dos
   * solicitantes que validan a la vez pueden reservar los dos el ultimo saldo.
   * Prisma no expresa `FOR UPDATE`, por eso va en SQL crudo.
   */
  private async bloquearLotes(
    tx: { $queryRawUnsafe: (sql: string) => Promise<unknown> },
    detalles: { ingresoDetalleId: number }[],
  ) {
    const ids = [...new Set(detalles.map((d) => d.ingresoDetalleId))];
    if (ids.length === 0) return;
    // Los ids son enteros ya validados por class-validator (@IsInt).
    await tx.$queryRawUnsafe(
      `SELECT id FROM ingreso_detalles WHERE id IN (${ids.join(',')}) FOR UPDATE`,
    );
  }

  private datosLinea(d: EgresoDetalleDto) {
    return {
      ingresoDetalleId: d.ingresoDetalleId,
      cantidadSolicitada: d.cantidadSolicitada,
    };
  }

  private async registrarHistorial(
    tx: {
      egresoHistorial: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    },
    egresoId: number,
    estadoAnterior: EstadoEgreso | null,
    estadoNuevo: EstadoEgreso,
    user: AuthenticatedUser,
    motivo?: string,
  ) {
    await tx.egresoHistorial.create({
      data: {
        egresoId,
        estadoAnterior,
        estadoNuevo,
        usuarioId: user.id,
        motivo: motivo ?? null,
      },
    });
  }
}
