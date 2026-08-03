import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import {
  almacenesPermitidos,
  filtroAlmacen,
} from '../../common/scope/almacenes-permitidos';
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

/**
 * Rango sobre `fechaIngreso` para el `where` de Prisma.
 *
 * Los dos extremos son INCLUSIVOS: `hasta` se lleva al dia siguiente y se
 * compara con `lt`, porque la fecha guardada tiene hora y un `lte` sobre la
 * medianoche dejaria afuera todo lo registrado ese mismo dia. Se interpretan
 * en UTC, igual que el kardex (`Date.UTC` en `KardexService.findAll`).
 */
function rangoFechaIngreso(
  desde?: string,
  hasta?: string,
): { fechaIngreso?: { gte?: Date; lt?: Date } } {
  if (!desde && !hasta) return {};

  const aUtc = (valor: string, sumarDias = 0) => {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia + sumarDias));
  };

  return {
    fechaIngreso: {
      ...(desde ? { gte: aUtc(desde) } : {}),
      ...(hasta ? { lt: aUtc(hasta, 1) } : {}),
    },
  };
}

/**
 * Total de un ingreso: la suma de sus lineas (cantidad x precio).
 *
 * No es una columna de la tabla y no se puede resolver con un `groupBy` de
 * Prisma, que solo agrega columnas sueltas y no un producto. Con una pagina de
 * filas —o un reporte de un rango— el costo de sumarlo aca es despreciable.
 */
function totalDeLineas(
  detalles: { cantidad: unknown; precioUnitario: unknown }[],
): string {
  return detalles
    .reduce(
      (suma, d) => suma + Number(d.cantidad) * Number(d.precioUnitario),
      0,
    )
    .toFixed(2);
}

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

/** Campos de cabecera comunes a crear y editar (todos opcionales). */
type DatosCabecera = {
  fechaRemision?: string;
  notaRemision?: string;
  procesoC31?: string;
  certificacion?: string;
  informeConformidad?: string;
  fechaInformeConformidad?: string;
  numeroFactura?: string;
  observacion?: string;
  proveedorId?: number | null;
  fuenteFinanciamientoId?: number | null;
  responsableConformidadId?: number | null;
  unidadSolicitanteId?: number | null;
};

const ingresoListSelect = {
  id: true,
  estado: true,
  numero: true,
  gestion: true,
  almacenId: true,
  fechaIngreso: true,
  fechaRemision: true,
  notaRemision: true,
  procesoC31: true,
  numeroFactura: true,
  // La observacion es columna del listado (dice de que fue la compra).
  observacion: true,
  createdAt: true,
  updatedAt: true,
  almacen: { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true } },
  fuenteFinanciamiento: { select: { id: true, nombre: true } },
  _count: { select: { detalles: true } },
  // Solo para sumar el total de la cabecera (ver `findAll`); las lineas
  // completas las trae `ingresoFullSelect`.
  detalles: { select: { cantidad: true, precioUnitario: true } },
} as const;

const ingresoFullSelect = {
  id: true,
  estado: true,
  numero: true,
  gestion: true,
  almacenId: true,
  fechaIngreso: true,
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
  // El `nit` del proveedor y el `cargo` de las personas los pide la nota de
  // ingreso impresa (encabezado y pies de firma); no los usa el formulario.
  proveedor: { select: { id: true, nombre: true, nit: true } },
  fuenteFinanciamiento: { select: { id: true, nombre: true } },
  responsableConformidad: { select: { id: true, nombre: true, cargo: true } },
  unidadSolicitante: { select: { id: true, nombre: true, sigla: true } },
  registradoPor: { select: { id: true, nombre: true, cargo: true } },
  anuladoPor: { select: { id: true, nombre: true } },
  detalles: {
    select: {
      id: true,
      itemId: true,
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
          // La partida va como columna propia en la nota impresa (el codigo del
          // item la lleva de prefijo, pero el documento oficial la separa).
          partida: { select: { id: true, codigo: true } },
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

  /**
   * `where` del listado, compartido con el reporte imprimible: los dos tienen
   * que responder a los MISMOS filtros o el papel no coincidiria con lo que se
   * ve en pantalla.
   */
  private async armarWhere(query: QueryIngresosDto, user: AuthenticatedUser) {
    // Los tres campos por los que se busca un ingreso en la practica. Cada uno
    // tiene su indice GIN (migracion 20260803150000_ingresos_busqueda_campos):
    // agregar una columna aca sin su indice deja la busqueda andando pero con
    // scan secuencial.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'ingresos',
          ['proceso_c31', 'certificacion', 'observacion'],
          query.q,
        )
      : null;

    const scope = await this.almacenesPermitidos(user);

    return {
      // El helper compartido cruza el scope del rol con el almacen pedido; no
      // repetir la regla aca (la misma la aplican stock y kardex).
      ...filtroAlmacen(scope, query.almacenId),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.gestion ? { gestion: query.gestion } : {}),
      ...(query.proveedorId ? { proveedorId: query.proveedorId } : {}),
      ...(query.fuenteFinanciamientoId
        ? { fuenteFinanciamientoId: query.fuenteFinanciamientoId }
        : {}),
      ...rangoFechaIngreso(query.desde, query.hasta),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };
  }

  async findAll(query: QueryIngresosDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = await this.armarWhere(query, user);

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

    // Las lineas se descartan despues de sumarlas: el listado sigue devolviendo
    // la forma liviana.
    const filas = data.map(({ detalles, ...ingreso }) => ({
      ...ingreso,
      total: totalDeLineas(detalles),
    }));

    return paginated(filas, total, page, pageSize);
  }

  /**
   * Los ingresos del rango, SIN paginar, para el reporte imprimible.
   *
   * Responde a los mismos filtros que el listado (incluido el rango de fechas)
   * pero en orden CRONOLOGICO ascendente: en el papel se lee como un libro, no
   * como una bandeja de novedades.
   */
  async reporte(query: QueryIngresosDto, user: AuthenticatedUser) {
    const where = await this.armarWhere(query, user);

    const ingresos = await this.prisma.ingreso.findMany({
      where,
      select: {
        id: true,
        estado: true,
        numero: true,
        gestion: true,
        fechaIngreso: true,
        observacion: true,
        almacen: { select: { id: true, nombre: true } },
        detalles: { select: { cantidad: true, precioUnitario: true } },
      },
      orderBy: [{ fechaIngreso: 'asc' }, { id: 'asc' }],
    });

    return ingresos.map(({ detalles, ...ingreso }) => ({
      ...ingreso,
      total: totalDeLineas(detalles),
    }));
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
  // Crear (registra el ingreso DEFINITIVO: numero + lotes + Kardex, en una
  // transaccion; ya no hay borrador)
  // ---------------------------------------------------------------------------

  /**
   * Registra un ingreso en un solo paso. Valida respaldos + >=1 item, estampa el
   * numero correlativo por almacen+gestion, crea los lotes (saldo = cantidad) y
   * una ENTRADA de Kardex por linea. Si falta algun dato, responde con la lista
   * de pendientes y no crea nada.
   */
  async create(dto: CreateIngresoDto, user: AuthenticatedUser) {
    const almacenId = this.resolverAlmacen(dto.almacenId, user);
    await this.validarAlmacen(almacenId);
    this.validarObligatorios(dto);
    await this.validarReferencias(dto);
    await this.validarItems(dto.detalles);
    await this.validarResponsableConformidad(
      dto.responsableConformidadId ?? null,
    );
    await this.validarUnidadEnAlmacen(
      dto.unidadSolicitanteId as number,
      almacenId,
    );

    // La fecha del ingreso es el momento del registro: no la elige nadie, asi
    // que no se puede equivocar ni manipular. De ella salen la gestion (y con
    // ella el correlativo) y la fecha del Kardex. La de remision es del
    // documento del proveedor y ya no gobierna nada. Solo el super_admin puede
    // corregirla despues (ver `update`).
    const fechaIngreso = new Date();
    const gestion = fechaIngreso.getFullYear();

    const id = await this.prisma.$transaction(async (tx) => {
      // Correlativo por almacen + gestion.
      const agg = await tx.ingreso.aggregate({
        _max: { numero: true },
        where: { almacenId, gestion },
      });
      const numero = (agg._max.numero ?? 0) + 1;

      const ingreso = await tx.ingreso.create({
        data: {
          estado: EstadoIngreso.CONFIRMADO,
          numero,
          gestion,
          fechaIngreso,
          almacenId,
          registradoPorId: user.id,
          ...this.datosDesdeDto(dto),
        },
        select: { id: true },
      });

      // Un lote + una ENTRADA de Kardex por linea (el saldo del lote es = cantidad).
      for (const d of dto.detalles as IngresoDetalleDto[]) {
        const lote = await tx.ingresoDetalle.create({
          data: { ingresoId: ingreso.id, ...this.datosLote(d) },
          select: { id: true },
        });
        await tx.movimientoKardex.create({
          data: {
            tipo: TipoMovimiento.ENTRADA,
            itemId: d.itemId,
            almacenId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            ingresoId: ingreso.id,
            ingresoDetalleId: lote.id,
            fecha: fechaIngreso,
          },
        });
      }

      return ingreso.id;
    });

    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------------------
  // Editar (la cabecera documental; NO las lineas, el almacen, la fuente ni la
  // fecha de remision -> eso toca stock/valorizacion: para corregirlo se anula y
  // se vuelve a registrar).
  //
  // La excepcion es la FECHA DE INGRESO, que solo el super_admin puede corregir:
  // arrastra la gestion, el correlativo y el Kardex, y por eso se resuelve
  // entera dentro de una transaccion.
  // ---------------------------------------------------------------------------

  async update(id: number, dto: UpdateIngresoDto, user: AuthenticatedUser) {
    const existente = await this.cargarParaEscritura(id, user);
    if (existente.estado !== EstadoIngreso.CONFIRMADO) {
      throw new BadRequestException('Un ingreso anulado no se puede editar');
    }

    await this.validarReferencias(dto);
    // El responsable se valida SOLO si cambia. Reenviar el que ya tenia se
    // acepta aunque hoy este dado de baja: un ingreso ya registrado es un hecho
    // historico y no puede quedar bloqueado porque esa persona dejo la
    // institucion. Los catalogos filtran activos para lo NUEVO; los documentos
    // ya emitidos conservan su referencia.
    if (
      dto.responsableConformidadId != null &&
      dto.responsableConformidadId !== existente.responsableConformidadId
    ) {
      await this.validarResponsableConformidad(dto.responsableConformidadId);
    }
    if (dto.unidadSolicitanteId != null) {
      await this.validarUnidadEnAlmacen(
        dto.unidadSolicitanteId,
        existente.almacenId,
      );
    }

    const nuevaFecha = this.resolverCorreccionDeFecha(dto, existente, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.ingreso.update({
        where: { id },
        data: {
          ...this.datosDesdeDto(dto),
          ...(nuevaFecha ? { fechaIngreso: nuevaFecha } : {}),
        },
      });

      if (!nuevaFecha) return;

      // El Kardex se ordena por la fecha del movimiento, no por la del ingreso:
      // si no se mueven, el libro queda contando la entrada en el dia viejo.
      await tx.movimientoKardex.updateMany({
        where: { ingresoId: id },
        data: { fecha: nuevaFecha },
      });

      // Cambiar de gestion obliga a re-estampar el correlativo: el numero se
      // asigno dentro de la secuencia de la gestion anterior y ahi no vale
      // (`@@unique([almacenId, gestion, numero])`). Va en la misma transaccion
      // que el resto para que el ingreso nunca quede con la gestion nueva y el
      // numero viejo.
      const gestion = nuevaFecha.getFullYear();
      if (gestion === existente.gestion) return;

      const agg = await tx.ingreso.aggregate({
        _max: { numero: true },
        where: { almacenId: existente.almacenId, gestion },
      });
      await tx.ingreso.update({
        where: { id },
        data: { gestion, numero: (agg._max.numero ?? 0) + 1 },
      });
    });

    return this.findOne(id, user);
  }

  /**
   * Fecha de ingreso corregida, o null si no hay que tocarla. Solo el
   * super_admin puede correr esta fecha: de ella salen la gestion, el
   * correlativo y el Kardex, asi que no es un dato de cabecera cualquiera.
   * El caso previsto es el cierre de gestion (material que entro el 28/12 y se
   * registro el 2/1).
   */
  private resolverCorreccionDeFecha(
    dto: UpdateIngresoDto,
    existente: { fechaIngreso: Date },
    user: AuthenticatedUser,
  ): Date | null {
    if (dto.fechaIngreso === undefined) return null;

    if (user.rol !== Rol.super_admin) {
      throw new ForbiddenException(
        'Solo el super_admin puede corregir la fecha de ingreso',
      );
    }

    const fecha = new Date(dto.fechaIngreso);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha de ingreso no es valida');
    }
    // Una fecha futura no significa nada: el material ya esta en el almacen.
    if (fecha.getTime() > Date.now()) {
      throw new BadRequestException(
        'La fecha de ingreso no puede ser posterior a hoy',
      );
    }
    // Sin cambio real no se toca nada (evita reescribir el Kardex al pedo).
    if (fecha.getTime() === existente.fechaIngreso.getTime()) return null;

    return fecha;
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

  /**
   * null = sin restriccion (admin/super_admin). Array = almacenes que puede ver.
   * La regla vive en `common/scope`: la comparten stock, kardex y egresos.
   */
  private almacenesPermitidos(user: AuthenticatedUser) {
    return almacenesPermitidos(this.prisma, user);
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
      select: {
        id: true,
        estado: true,
        almacenId: true,
        // Lo necesita el update para saber si el responsable CAMBIO (ver abajo).
        responsableConformidadId: true,
        // Los necesita la correccion de fecha del super_admin: para saber si la
        // fecha cambio de verdad y si hay que re-estampar el correlativo.
        fechaIngreso: true,
        gestion: true,
      },
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
  private async validarReferencias(dto: DatosCabecera) {
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
          `No existe el responsable / comision de recepcion con id ${dto.responsableConformidadId}`,
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

  /** Antes de registrar: todos los respaldos obligatorios + al menos un ítem. */
  private validarObligatorios(dto: CreateIngresoDto) {
    const faltan: string[] = [];
    if (!dto.fechaRemision) faltan.push('fecha de remisión');
    if (!dto.notaRemision?.trim()) faltan.push('nota de remisión');
    if (!dto.procesoC31?.trim()) faltan.push('proceso Nº / C31');
    if (!dto.certificacion?.trim()) faltan.push('certificación');
    if (!dto.informeConformidad?.trim())
      faltan.push('informe/acta de conformidad');
    if (!dto.fechaInformeConformidad) faltan.push('fecha del informe/acta');
    // El numero de factura NO se exige: hay material que entra sin factura
    // (donaciones, transferencias). En el sistema anterior el 17% de los
    // ingresos no tenia uno util. Ver docs/decisiones-ingresos.md, punto 4.
    if (dto.proveedorId == null) faltan.push('proveedor');
    if (dto.fuenteFinanciamientoId == null)
      faltan.push('fuente de financiamiento');
    if (dto.responsableConformidadId == null)
      faltan.push('responsable / comisión de recepción');
    if (dto.unidadSolicitanteId == null) faltan.push('unidad solicitante');
    if (!dto.detalles || dto.detalles.length === 0)
      faltan.push('al menos un ítem');
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan datos para registrar el ingreso: ${faltan.join(', ')}`,
      );
    }
  }

  /** El responsable / comision de recepcion debe ser un usuario con rol solicitador activo. */
  private async validarResponsableConformidad(usuarioId: number | null) {
    if (usuarioId == null) return; // ya cubierto por validarRespaldos
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true, activo: true },
    });
    if (!usuario || !usuario.activo || usuario.rol !== Rol.solicitador) {
      throw new BadRequestException(
        'El responsable / comisión de recepción debe ser un usuario activo con rol solicitador',
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
  private datosDesdeDto(dto: DatosCabecera) {
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
      observacion: normalizar(d.observacion),
    };
  }
}
