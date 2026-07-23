import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import {
  EstadoIngreso,
  Rol,
  TipoMovimiento,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AnularIngresoDto } from './dto/anular-ingreso.dto';
import { CreateIngresoDto } from './dto/create-ingreso.dto';
import { IngresoDetalleDto } from './dto/ingreso-detalle.dto';
import { QueryIngresosDto } from './dto/query-ingresos.dto';
import { UpdateIngresoDto } from './dto/update-ingreso.dto';

/** Cadena vacia o solo espacios -> null; recorta el resto. */
function normalizar(valor?: string): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function aFecha(valor?: string): Date | null | undefined {
  if (valor === undefined) return undefined;
  return valor ? new Date(valor) : null;
}

const ingresoListSelect = {
  id: true,
  estado: true,
  numero: true,
  gestion: true,
  almacenId: true,
  fechaRemision: true,
  notaRemision: true,
  procesoC31: true,
  numeroFactura: true,
  createdAt: true,
  updatedAt: true,
  almacen: { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true } },
  fuenteFinanciamiento: { select: { id: true, nombre: true } },
  _count: { select: { detalles: true } },
} as const;

const ingresoFullSelect = {
  id: true,
  estado: true,
  numero: true,
  gestion: true,
  almacenId: true,
  fechaRemision: true,
  notaRemision: true,
  procesoC31: true,
  certificacion: true,
  informeConformidad: true,
  fechaInformeConformidad: true,
  numeroFactura: true,
  observacion: true,
  proveedorId: true,
  fuenteFinanciamientoId: true,
  responsableConformidadId: true,
  unidadSolicitanteId: true,
  registradoPorId: true,
  anuladoPorId: true,
  anuladoEn: true,
  motivoAnulacion: true,
  createdAt: true,
  updatedAt: true,
  almacen: { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true } },
  fuenteFinanciamiento: { select: { id: true, nombre: true } },
  responsableConformidad: { select: { id: true, nombre: true } },
  unidadSolicitante: { select: { id: true, nombre: true, sigla: true } },
  registradoPor: { select: { id: true, nombre: true } },
  anuladoPor: { select: { id: true, nombre: true } },
  detalles: {
    select: {
      id: true,
      itemId: true,
      cantidad: true,
      precioUnitario: true,
      saldoCantidad: true,
      item: {
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidadMedida: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  },
} as const;

@Injectable()
export class IngresosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  async findAll(query: QueryIngresosDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'ingresos',
          ['nota_remision', 'proceso_c31', 'numero_factura'],
          query.q,
        )
      : null;

    const scope = await this.almacenesPermitidos(user);

    const where = {
      ...(scope !== null ? { almacenId: { in: scope } } : {}),
      ...(query.almacenId && scope === null
        ? { almacenId: query.almacenId }
        : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.gestion ? { gestion: query.gestion } : {}),
      ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
      ...(query.fuenteFinanciamientoId
        ? { fuenteFinanciamientoId: query.fuenteFinanciamientoId }
        : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.ingreso.findMany({
        where,
        select: ingresoListSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ingreso.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const ingreso = await this.prisma.ingreso.findUnique({
      where: { id },
      select: ingresoFullSelect,
    });
    if (!ingreso) {
      throw new NotFoundException(`No existe el ingreso con id ${id}`);
    }
    await this.verificarScope(ingreso.almacenId, user);
    return ingreso;
  }

  // ---------------------------------------------------------------------------
  // Borrador: crear / editar / eliminar
  // ---------------------------------------------------------------------------

  async create(dto: CreateIngresoDto, user: AuthenticatedUser) {
    const almacenId = this.resolverAlmacen(dto.almacenId, user);
    await this.validarAlmacen(almacenId);
    await this.validarReferencias(dto);
    await this.validarItems(dto.detalles);

    const id = await this.prisma.$transaction(async (tx) => {
      const ingreso = await tx.ingreso.create({
        data: {
          estado: EstadoIngreso.BORRADOR,
          almacenId,
          registradoPorId: user.id,
          ...this.datosDesdeDto(dto),
          detalles: dto.detalles
            ? { create: dto.detalles.map((d) => this.datosLote(d)) }
            : undefined,
        },
        select: { id: true },
      });
      return ingreso.id;
    });

    return this.findOne(id, user);
  }

  async update(id: number, dto: UpdateIngresoDto, user: AuthenticatedUser) {
    const existente = await this.cargarParaEscritura(id, user);
    if (existente.estado !== EstadoIngreso.BORRADOR) {
      throw new BadRequestException(
        'Solo se puede editar un ingreso en borrador',
      );
    }

    await this.validarReferencias(dto);
    await this.validarItems(dto.detalles);

    await this.prisma.$transaction(async (tx) => {
      await tx.ingreso.update({
        where: { id },
        data: this.datosDesdeDto(dto),
      });
      // Reemplaza el conjunto de lineas (en borrador no hay kardex que las ate).
      if (dto.detalles !== undefined) {
        await tx.ingresoDetalle.deleteMany({ where: { ingresoId: id } });
        if (dto.detalles.length > 0) {
          await tx.ingresoDetalle.createMany({
            data: dto.detalles.map((d) => ({
              ingresoId: id,
              ...this.datosLote(d),
            })),
          });
        }
      }
    });

    return this.findOne(id, user);
  }

  /** Borra un borrador (hard delete). Un ingreso confirmado no se borra: se anula. */
  async remove(id: number, user: AuthenticatedUser) {
    const existente = await this.cargarParaEscritura(id, user);
    if (existente.estado !== EstadoIngreso.BORRADOR) {
      throw new BadRequestException(
        'Solo se puede eliminar un borrador. Un ingreso confirmado se anula.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.ingresoDetalle.deleteMany({ where: { ingresoId: id } });
      await tx.ingreso.delete({ where: { id } });
    });
    return { id, eliminado: true };
  }

  // ---------------------------------------------------------------------------
  // Confirmar (ejecuta la entrada al stock)
  // ---------------------------------------------------------------------------

  async confirmar(id: number, user: AuthenticatedUser) {
    const ingreso = await this.prisma.ingreso.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!ingreso) {
      throw new NotFoundException(`No existe el ingreso con id ${id}`);
    }
    await this.verificarScope(ingreso.almacenId, user);

    if (ingreso.estado !== EstadoIngreso.BORRADOR) {
      throw new BadRequestException('Solo se confirma un ingreso en borrador');
    }

    this.validarRespaldos(ingreso);
    if (ingreso.detalles.length === 0) {
      throw new BadRequestException(
        'Agregá al menos un ítem antes de confirmar',
      );
    }
    await this.validarResponsableConformidad(ingreso.responsableConformidadId);
    await this.validarUnidadEnAlmacen(
      ingreso.unidadSolicitanteId as number,
      ingreso.almacenId,
    );

    // La gestion sale del anio de la fecha de remision (obligatoria acá).
    const gestion = (ingreso.fechaRemision as Date).getFullYear();

    await this.prisma.$transaction(async (tx) => {
      // Correlativo por almacen + gestion (los borradores tienen numero null).
      const agg = await tx.ingreso.aggregate({
        _max: { numero: true },
        where: { almacenId: ingreso.almacenId, gestion },
      });
      const numero = (agg._max.numero ?? 0) + 1;

      await tx.ingreso.update({
        where: { id },
        data: { estado: EstadoIngreso.CONFIRMADO, numero, gestion },
      });

      // Una entrada de Kardex por lote. El saldo del lote ya es = cantidad.
      for (const d of ingreso.detalles) {
        await tx.movimientoKardex.create({
          data: {
            tipo: TipoMovimiento.ENTRADA,
            itemId: d.itemId,
            almacenId: ingreso.almacenId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            ingresoId: id,
            ingresoDetalleId: d.id,
            fecha: ingreso.fechaRemision as Date,
          },
        });
      }
    });

    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------------------
  // Anular (revierte la entrada)
  // ---------------------------------------------------------------------------

  async anular(id: number, dto: AnularIngresoDto, user: AuthenticatedUser) {
    const ingreso = await this.prisma.ingreso.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!ingreso) {
      throw new NotFoundException(`No existe el ingreso con id ${id}`);
    }
    await this.verificarScope(ingreso.almacenId, user);

    if (ingreso.estado !== EstadoIngreso.CONFIRMADO) {
      throw new BadRequestException(
        'Solo se puede anular un ingreso confirmado',
      );
    }
    // Bloqueo: si de algun lote ya salio material, no se puede anular.
    const conSalida = ingreso.detalles.some(
      (d) => !d.saldoCantidad.equals(d.cantidad),
    );
    if (conSalida) {
      throw new ConflictException(
        'No se puede anular: ya salió material de alguno de sus lotes. Anulá primero esos egresos.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ingreso.update({
        where: { id },
        data: {
          estado: EstadoIngreso.ANULADO,
          anuladoPorId: user.id,
          anuladoEn: new Date(),
          motivoAnulacion: dto.motivo.trim(),
        },
      });
      for (const d of ingreso.detalles) {
        await tx.movimientoKardex.create({
          data: {
            tipo: TipoMovimiento.REVERSION,
            itemId: d.itemId,
            almacenId: ingreso.almacenId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            ingresoId: id,
            ingresoDetalleId: d.id,
            fecha: new Date(),
            motivo: dto.motivo.trim(),
          },
        });
        // El lote deja de aportar stock (ademas queda excluido por estado ANULADO).
        await tx.ingresoDetalle.update({
          where: { id: d.id },
          data: { saldoCantidad: 0 },
        });
      }
    });

    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------------------
  // Helpers de scope / almacen
  // ---------------------------------------------------------------------------

  /** null = sin restriccion (admin/super_admin). Array = almacenes que puede ver. */
  private async almacenesPermitidos(
    user: AuthenticatedUser,
  ): Promise<number[] | null> {
    if (user.rol === Rol.responsable_almacen) {
      return user.almacenId != null ? [user.almacenId] : [];
    }
    if (user.rol === Rol.observador_almacen) {
      const observados = await this.prisma.usuarioAlmacenObservado.findMany({
        where: { usuarioId: user.id },
        select: { almacenId: true },
      });
      return observados.map((o) => o.almacenId);
    }
    return null; // super_admin / admin
  }

  private async verificarScope(almacenId: number, user: AuthenticatedUser) {
    const permitidos = await this.almacenesPermitidos(user);
    if (permitidos !== null && !permitidos.includes(almacenId)) {
      // No se filtra informacion de otros almacenes: se responde como no encontrado.
      throw new NotFoundException('No existe el ingreso');
    }
  }

  /** Carga el ingreso para escritura (existe + dentro del scope del usuario). */
  private async cargarParaEscritura(id: number, user: AuthenticatedUser) {
    const ingreso = await this.prisma.ingreso.findUnique({
      where: { id },
      select: { id: true, estado: true, almacenId: true },
    });
    if (!ingreso) {
      throw new NotFoundException(`No existe el ingreso con id ${id}`);
    }
    await this.verificarScope(ingreso.almacenId, user);
    return ingreso;
  }

  /** Resuelve el almacen del ingreso segun el rol de quien lo crea. */
  private resolverAlmacen(
    almacenIdDto: number | undefined,
    user: AuthenticatedUser,
  ): number {
    if (user.rol === Rol.responsable_almacen) {
      if (user.almacenId == null) {
        throw new ForbiddenException('Tu usuario no tiene un almacén asignado');
      }
      return user.almacenId; // ignora lo que venga en el DTO
    }
    // super_admin / admin: deben elegir a que almacen entra.
    if (almacenIdDto == null) {
      throw new BadRequestException('Elegí el almacén del ingreso');
    }
    return almacenIdDto;
  }

  // ---------------------------------------------------------------------------
  // Validaciones
  // ---------------------------------------------------------------------------

  private async validarAlmacen(almacenId: number) {
    const almacen = await this.prisma.almacen.findUnique({
      where: { id: almacenId },
      select: { activo: true },
    });
    if (!almacen) {
      throw new BadRequestException(`No existe el almacén con id ${almacenId}`);
    }
    if (!almacen.activo) {
      throw new BadRequestException(
        `El almacén con id ${almacenId} está inactivo`,
      );
    }
  }

  /** Verifica que las referencias enviadas (proveedor, fuente, etc.) existan. */
  private async validarReferencias(dto: CreateIngresoDto | UpdateIngresoDto) {
    if (dto.proveedorId != null) {
      const x = await this.prisma.proveedor.findUnique({
        where: { id: dto.proveedorId },
        select: { id: true },
      });
      if (!x) {
        throw new BadRequestException(
          `No existe el proveedor con id ${dto.proveedorId}`,
        );
      }
    }
    if (dto.fuenteFinanciamientoId != null) {
      const x = await this.prisma.fuenteFinanciamiento.findUnique({
        where: { id: dto.fuenteFinanciamientoId },
        select: { id: true },
      });
      if (!x) {
        throw new BadRequestException(
          `No existe la fuente de financiamiento con id ${dto.fuenteFinanciamientoId}`,
        );
      }
    }
    if (dto.responsableConformidadId != null) {
      const x = await this.prisma.usuario.findUnique({
        where: { id: dto.responsableConformidadId },
        select: { id: true },
      });
      if (!x) {
        throw new BadRequestException(
          `No existe el responsable de conformidad con id ${dto.responsableConformidadId}`,
        );
      }
    }
    if (dto.unidadSolicitanteId != null) {
      const x = await this.prisma.unidad.findUnique({
        where: { id: dto.unidadSolicitanteId },
        select: { id: true },
      });
      if (!x) {
        throw new BadRequestException(
          `No existe la unidad solicitante con id ${dto.unidadSolicitanteId}`,
        );
      }
    }
  }

  private async validarItems(detalles?: IngresoDetalleDto[]) {
    if (!detalles || detalles.length === 0) return;
    const ids = [...new Set(detalles.map((d) => d.itemId))];
    const encontrados = await this.prisma.item.count({
      where: { id: { in: ids }, activo: true },
    });
    if (encontrados !== ids.length) {
      throw new BadRequestException(
        'Alguno de los ítems no existe o está inactivo',
      );
    }
  }

  /** Todos los respaldos obligatorios deben estar antes de confirmar. */
  private validarRespaldos(ingreso: {
    fechaRemision: Date | null;
    notaRemision: string | null;
    procesoC31: string | null;
    certificacion: string | null;
    informeConformidad: string | null;
    fechaInformeConformidad: Date | null;
    proveedorId: number | null;
    fuenteFinanciamientoId: number | null;
    responsableConformidadId: number | null;
    unidadSolicitanteId: number | null;
  }) {
    const faltan: string[] = [];
    if (!ingreso.fechaRemision) faltan.push('fecha de remisión');
    if (!ingreso.notaRemision) faltan.push('nota de remisión');
    if (!ingreso.procesoC31) faltan.push('proceso Nº / C31');
    if (!ingreso.certificacion) faltan.push('certificación');
    if (!ingreso.informeConformidad) faltan.push('informe/acta de conformidad');
    if (!ingreso.fechaInformeConformidad) faltan.push('fecha del informe/acta');
    if (!ingreso.proveedorId) faltan.push('proveedor');
    if (!ingreso.fuenteFinanciamientoId)
      faltan.push('fuente de financiamiento');
    if (!ingreso.responsableConformidadId)
      faltan.push('responsable de conformidad');
    if (!ingreso.unidadSolicitanteId) faltan.push('unidad solicitante');
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan datos para confirmar: ${faltan.join(', ')}`,
      );
    }
  }

  /** El responsable de conformidad debe ser un usuario con rol solicitador activo. */
  private async validarResponsableConformidad(usuarioId: number | null) {
    if (usuarioId == null) return; // ya cubierto por validarRespaldos
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true, activo: true },
    });
    if (!usuario || !usuario.activo || usuario.rol !== Rol.solicitador) {
      throw new BadRequestException(
        'El responsable de conformidad debe ser un usuario activo con rol solicitador',
      );
    }
  }

  /** La unidad solicitante debe estar entre las que muestra el almacén. */
  private async validarUnidadEnAlmacen(unidadId: number, almacenId: number) {
    const enlace = await this.prisma.almacenUnidad.findUnique({
      where: { almacenId_unidadId: { almacenId, unidadId } },
      select: { almacenId: true },
    });
    if (!enlace) {
      throw new BadRequestException(
        'La unidad solicitante no pertenece a este almacén',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Armado de datos
  // ---------------------------------------------------------------------------

  /** Campos de cabecera provistos por el DTO (solo los que vinieron). */
  private datosDesdeDto(dto: CreateIngresoDto | UpdateIngresoDto) {
    return {
      ...(dto.fechaRemision !== undefined
        ? { fechaRemision: aFecha(dto.fechaRemision) }
        : {}),
      ...(dto.notaRemision !== undefined
        ? { notaRemision: normalizar(dto.notaRemision) }
        : {}),
      ...(dto.procesoC31 !== undefined
        ? { procesoC31: normalizar(dto.procesoC31) }
        : {}),
      ...(dto.certificacion !== undefined
        ? { certificacion: normalizar(dto.certificacion) }
        : {}),
      ...(dto.informeConformidad !== undefined
        ? { informeConformidad: normalizar(dto.informeConformidad) }
        : {}),
      ...(dto.fechaInformeConformidad !== undefined
        ? { fechaInformeConformidad: aFecha(dto.fechaInformeConformidad) }
        : {}),
      ...(dto.numeroFactura !== undefined
        ? { numeroFactura: normalizar(dto.numeroFactura) }
        : {}),
      ...(dto.observacion !== undefined
        ? { observacion: normalizar(dto.observacion) }
        : {}),
      ...(dto.proveedorId !== undefined
        ? { proveedorId: dto.proveedorId ?? null }
        : {}),
      ...(dto.fuenteFinanciamientoId !== undefined
        ? { fuenteFinanciamientoId: dto.fuenteFinanciamientoId ?? null }
        : {}),
      ...(dto.responsableConformidadId !== undefined
        ? { responsableConformidadId: dto.responsableConformidadId ?? null }
        : {}),
      ...(dto.unidadSolicitanteId !== undefined
        ? { unidadSolicitanteId: dto.unidadSolicitanteId ?? null }
        : {}),
    };
  }

  /** Datos de un lote: el saldo inicial es la cantidad. */
  private datosLote(d: IngresoDetalleDto) {
    return {
      itemId: d.itemId,
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
      saldoCantidad: d.cantidad,
    };
  }
}
