import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { paginated } from '../../common/dto/paginated-result';
import { bloquearSerie } from '../../common/correlativo/bloquear-serie';
import { gestionDe, inicioDelDia } from '../../common/fechas/zona-horaria';
import type { Prisma } from '../../generated/prisma/client';
import { almacenesPermitidos } from '../../common/scope/almacenes-permitidos';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import {
  ESTADOS_CON_RELOJ,
  limiteReserva,
  MINUTOS_RESERVA_POR_DEFECTO,
  minutosReserva,
  reservadoPorLote,
  textoDuracionReserva,
  vencimientoReserva,
} from '../../common/stock/reserva';
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
 * `lt`, porque la fecha guardada tiene hora. Dias de Bolivia, igual que el
 * kardex (`common/fechas/zona-horaria.ts`).
 */
function rangoFechaEgreso(desde?: string, hasta?: string) {
  if (!desde && !hasta) return {};

  const entre = {
    ...(desde ? { gte: inicioDelDia(desde) } : {}),
    ...(hasta ? { lt: inicioDelDia(hasta, 1) } : {}),
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
  reservaDesde: true,
  fechaEnvio: true,
  fechaEntrega: true,
  createdAt: true,
  almacen: { select: { id: true, nombre: true } },
  unidad: { select: { id: true, nombre: true, sigla: true } },
  solicitante: {
    select: { id: true, nombre: true, cargo: true, usuario: true },
  },
  _count: { select: { detalles: true } },
} as const;

/**
 * Agrega `reservaVence`: hasta cuando reserva el pedido, o `null` si no esta
 * en manos del solicitante (enviado, el reloj no corre). Lo calcula el backend
 * para que la regla de las 48 h viva en un solo lugar (`common/stock/reserva.ts`)
 * y la pantalla no tenga que repetirla.
 */
function conVencimiento<T extends { estado: EstadoEgreso; reservaDesde: Date }>(
  egreso: T,
) {
  return {
    ...egreso,
    reservaVence: ESTADOS_CON_RELOJ.includes(egreso.estado)
      ? vencimientoReserva(egreso.reservaDesde)
      : null,
  };
}

/**
 * Quien tiene el pedido AHORA, por el rol que le toca segun el estado. Los
 * cerrados (entregado, anulado, desistido) no lo tiene nadie.
 */
const ROL_QUE_ESPERA: Partial<
  Record<EstadoEgreso, 'solicitante' | 'aprobador' | 'responsable_almacen'>
> = {
  [EstadoEgreso.BORRADOR]: 'solicitante',
  [EstadoEgreso.DEVUELTO]: 'solicitante',
  [EstadoEgreso.PENDIENTE_APROBADOR]: 'aprobador',
  [EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN]: 'responsable_almacen',
};

type PersonaEspera = {
  id: number;
  nombre: string;
  cargo: string | null;
  usuario: string;
};

// El lote trae todo lo que la linea NO repite: item, fuente y precio.
const loteSelect = {
  id: true,
  precioUnitario: true,
  saldoCantidad: true,
  // La nota que el almacen escribio al RECIBIR el material (marca, color). Es lo
  // unico que distingue dos lotes del mismo item, que en el catalogo comparten
  // descripcion y foto — asi que viaja hasta el pedido y se imprime con la
  // descripcion, igual que en la nota de ingreso.
  observacion: true,
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

/**
 * Las ETAPAS del ciclo, agrupando los estados que se miran juntos.
 *
 * `BORRADOR` queda afuera de las dos: todavia no es un documento (no tiene
 * numero) y solo le importa a su dueño, asi que tiene su propia etapa. El
 * DEVUELTO, en cambio, SI esta en curso: ya tiene numero y sigue abierto —sin
 * el, un pedido rechazado desaparecia de la vista del almacen y la serie
 * parecia saltar un numero.
 */
const ESTADOS_EN_CURSO = [
  EstadoEgreso.DEVUELTO,
  EstadoEgreso.PENDIENTE_APROBADOR,
  EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
];
/** Los que MOVIERON stock: uno genero la SALIDA del Kardex, el otro su reversion. */
const ESTADOS_CERRADOS = [EstadoEgreso.ENTREGADO, EstadoEgreso.ANULADO];

/**
 * Roles con bandeja propia: los que tienen algo esperando una accion SUYA.
 * `admin`, `super_admin` y `observador_almacen` no la tienen — ven todo, pero
 * nada les espera a ellos.
 */
const ROLES_CON_BANDEJA: Rol[] = [
  Rol.solicitador,
  Rol.aprobador,
  Rol.responsable_almacen,
];

@Injectable()
export class EgresosService implements OnModuleInit {
  private readonly logger = new Logger(EgresosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Avisa si la reserva NO dura 48 h (`RESERVA_BORRADOR_MINUTOS` en el `.env`,
   * modo de prueba). Es facil olvidarla puesta, y en produccion vaciaria los
   * pedidos a los pocos minutos.
   */
  onModuleInit() {
    if (minutosReserva() !== MINUTOS_RESERVA_POR_DEFECTO) {
      this.logger.warn(
        `MODO DE PRUEBA: la reserva de los pedidos dura ${textoDuracionReserva()} ` +
          `(RESERVA_BORRADOR_MINUTOS=${minutosReserva()}), no 48 h. Sacala del .env fuera de las pruebas.`,
      );
    }
  }

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
          // `in` siempre: el filtro admite varios estados (el reporte pide los
          // dos que movieron stock) y uno solo es el caso de un elemento.
          ...(query.estado?.length ? { estado: { in: query.estado } } : {}),
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

    return paginated(
      await this.conEspera(data.map(conVencimiento)),
      total,
      page,
      pageSize,
    );
  }

  /**
   * Cuantos egresos hay en cada ETAPA del ciclo, dentro del alcance del usuario.
   *
   * Alimenta las pestañas del listado y el numerito del menu lateral. Existe
   * como endpoint propio y no se deriva del listado porque el listado esta
   * paginado y filtrado: su `total` responde a lo que se este mirando, no a
   * cuanto hay en las otras etapas.
   *
   * Sin estos numeros las pestañas no resuelven el problema que las motivo —
   * abrir la bandeja y encontrarla vacia sin saber que habia trabajo en otra
   * parte. Con ellos, eso se ve ANTES de hacer clic.
   */
  async resumen(user: AuthenticatedUser) {
    const alcance = await this.alcance(user);
    const contar = (extra: object) =>
      this.prisma.egreso.count({ where: { AND: [alcance, extra] } });

    const [bandeja, sinEnviar, enCurso, cerrados] = await Promise.all([
      // `null` (y no 0) cuando el rol no tiene bandeja: son cosas distintas
      // —«no te corresponde» vs. «te corresponde y esta vacia»— y la pantalla
      // dibuja o no la pestaña segun eso. Para admin/observador `filtroBandeja`
      // devuelve `{}`, que contaria TODOS los egresos: de ahi el corte.
      ROLES_CON_BANDEJA.includes(user.rol)
        ? contar(this.filtroBandeja(user))
        : Promise.resolve(null),
      contar({ estado: EstadoEgreso.BORRADOR }),
      contar({ estado: { in: ESTADOS_EN_CURSO } }),
      contar({ estado: { in: ESTADOS_CERRADOS } }),
    ]);

    return { bandeja, sinEnviar, enCurso, cerrados };
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
    const [conTodo] = await this.conEspera([
      conVencimiento(await this.conDisponible(egreso)),
    ]);
    return conTodo;
  }

  /**
   * Agrega `espera`: QUIEN tiene el pedido ahora y DESDE CUANDO (2026-10-29,
   * pedido del usuario: la primera pregunta de quien espera material es «¿a
   * quien le reclamo?»). `null` en los cerrados.
   *
   * No se guarda en el pedido: se deduce del estado, porque cada paso lo tiene
   * UNA persona (el solicitante, el aprobador activo de la unidad o el
   * responsable activo del almacen — los dos ultimos son unicos por indice).
   * Asi, si cambian al aprobador, sus pedidos pasan solos al nuevo.
   * `persona: null` en un paso de aprobador o responsable = no hay nadie
   * designado: el pedido no va a avanzar (no hay suplencia), y la pantalla lo
   * tiene que decir.
   *
   * `desde` es el ultimo CAMBIO de estado del historial. El vaciado por
   * vencimiento deja el estado igual, asi que no cuenta: el pedido ya estaba
   * en manos del solicitante desde antes.
   */
  private async conEspera<
    T extends {
      id: number;
      estado: EstadoEgreso;
      unidadId: number;
      almacenId: number;
      createdAt: Date;
      solicitante: PersonaEspera;
    },
  >(egresos: T[]) {
    const abiertos = egresos.filter((e) => ROL_QUE_ESPERA[e.estado]);
    const unidades = abiertos
      .filter((e) => ROL_QUE_ESPERA[e.estado] === 'aprobador')
      .map((e) => e.unidadId);
    const almacenes = abiertos
      .filter((e) => ROL_QUE_ESPERA[e.estado] === 'responsable_almacen')
      .map((e) => e.almacenId);

    const [designados, pasos] = await Promise.all([
      // Con listas vacias Prisma no trae nada: no hace falta saltear la consulta.
      this.prisma.usuario.findMany({
        where: {
          activo: true,
          OR: [
            { rol: Rol.aprobador, unidadId: { in: unidades } },
            { rol: Rol.responsable_almacen, almacenId: { in: almacenes } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          cargo: true,
          usuario: true,
          rol: true,
          unidadId: true,
          almacenId: true,
        },
      }),
      this.prisma.egresoHistorial.findMany({
        where: { egresoId: { in: abiertos.map((e) => e.id) } },
        select: {
          egresoId: true,
          estadoAnterior: true,
          estadoNuevo: true,
          createdAt: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const desde = new Map<number, Date>();
    for (const p of pasos) {
      if (p.estadoAnterior !== p.estadoNuevo)
        desde.set(p.egresoId, p.createdAt);
    }
    const persona = ({ id, nombre, cargo, usuario }: PersonaEspera) => ({
      id,
      nombre,
      cargo,
      usuario,
    });

    return egresos.map((e) => {
      const rol = ROL_QUE_ESPERA[e.estado];
      if (!rol) return { ...e, espera: null };
      const designado =
        rol === 'solicitante'
          ? e.solicitante
          : designados.find((u) =>
              rol === 'aprobador'
                ? u.rol === Rol.aprobador && u.unidadId === e.unidadId
                : u.rol === Rol.responsable_almacen &&
                  u.almacenId === e.almacenId,
            );
      return {
        ...e,
        espera: {
          rol,
          persona: designado ? persona(designado) : null,
          desde: desde.get(e.id) ?? e.createdAt,
        },
      };
    });
  }

  /**
   * Agrega a cada linea `disponible`: cuanto puede pedir ESTE pedido de su lote
   * — el saldo menos lo reservado por los DEMAS pedidos, la misma cuenta que
   * `validarDisponibilidad` al guardar. Solo mientras el pedido se edita (en
   * manos del solicitante); en otro estado va `null`.
   *
   * Existe porque el formulario tomaba el disponible del stock, que ya le resta
   * la reserva de este mismo pedido: un lote de 820 con 10 pedidos aca se veia
   * «disp. 810», y subir la cantidad a 815 se marcaba en rojo aunque el backend
   * la aceptaba.
   */
  private async conDisponible<
    T extends {
      id: number;
      estado: EstadoEgreso;
      detalles: {
        ingresoDetalleId: number;
        ingresoDetalle: { saldoCantidad: Prisma.Decimal };
      }[];
    },
  >(egreso: T) {
    const editable = ESTADOS_CON_RELOJ.includes(egreso.estado);
    const reservado = editable
      ? await reservadoPorLote(
          this.prisma,
          egreso.detalles.map((d) => d.ingresoDetalleId),
          { excluirEgresoId: egreso.id },
        )
      : null;

    return {
      ...egreso,
      detalles: egreso.detalles.map((d) => ({
        ...d,
        disponible: reservado
          ? Number(d.ingresoDetalle.saldoCantidad) -
            (reservado.get(d.ingresoDetalleId) ?? 0)
          : null,
      })),
    };
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

    const id = await this.prisma.$transaction(async (tx) => {
      // Primero el bloqueo, DESPUES la validacion: al reves, dos pedidos que
      // validan a la vez ven los dos el mismo disponible y los dos lo reservan.
      await this.bloquearLotes(tx, dto.detalles);
      await this.validarDisponibilidad(tx, dto.detalles, almacenId);

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

  /**
   * Edita el borrador. Si vienen `detalles`, reemplazan la lista completa.
   *
   * Si la reserva ya vencio y el pedido todavia tenia items (el proceso que lo
   * vacia corre cada minuto), se vacia ACA y se rechaza el guardado: el
   * formulario mandaria los items viejos y eso seria renovar la reserva sin
   * volver a elegir, que es justo lo que la regla quiere evitar.
   */
  async update(id: number, dto: UpdateEgresoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    this.exigirEstado(egreso.estado, ESTADOS_CON_RELOJ);
    this.exigirSolicitante(egreso.solicitanteId, user);
    await this.exigirReservaVigente(id);

    // Volver a elegir items despues de un vencimiento abre una reserva NUEVA de
    // 48 h. Mientras la reserva sigue vigente, editar NO la renueva: si no,
    // tocar el pedido cada dos dias retendria el material indefinidamente.
    const reabreReserva =
      dto.detalles !== undefined && egreso.reservaDesde <= limiteReserva();

    await this.prisma.$transaction(async (tx) => {
      // Confirma DENTRO de la transaccion que sigue en el mismo estado: el
      // solicitante pudo haberlo enviado desde otra pestaña mientras tanto.
      await this.transicionar(tx, id, egreso.estado, {
        ...(dto.justificacion !== undefined
          ? { justificacion: dto.justificacion.trim() }
          : {}),
        ...(reabreReserva ? { reservaDesde: new Date() } : {}),
      });

      if (dto.detalles) {
        await this.bloquearLotes(tx, dto.detalles);
        // El propio pedido se excluye del calculo: lo que el ya tenia reservado
        // no puede competir contra el mismo.
        await this.validarDisponibilidad(
          tx,
          dto.detalles,
          egreso.almacenId,
          id,
        );
        await tx.egresoDetalle.deleteMany({ where: { egresoId: id } });
        await tx.egresoDetalle.createMany({
          data: dto.detalles.map((d) => ({
            egresoId: id,
            ...this.datosLinea(d),
          })),
        });
      }
    });

    return this.findOne(id, user);
  }

  /**
   * Descarta un borrador. Se borra de verdad, a diferencia de un ingreso o de un
   * egreso ya enviado: un borrador todavia NO es un documento (no tiene numero) y
   * no toco stock. Dejarlo como "anulado" solo ensuciaria el listado y seguiria
   * apareciendo en el historial de nadie.
   *
   * Un DEVUELTO —fue enviado y rechazado, ya tiene numero— no se borra: dejaria
   * un hueco en la serie y se perderia su historial (quien lo aprobo, quien lo
   * rechazo y por que). Ese se cierra con `desistir`.
   */
  async remove(id: number, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    if (egreso.estado === EstadoEgreso.DEVUELTO) {
      throw new BadRequestException(
        'Este pedido ya tiene número: no se puede borrar. Si no lo vas a reenviar, desistilo.',
      );
    }
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
    this.exigirEstado(egreso.estado, ESTADOS_CON_RELOJ);
    this.exigirSolicitante(egreso.solicitanteId, user);
    // Vencidas las 48 h no se envia: se vacia y hay que volver a elegir.
    await this.exigirReservaVigente(id);

    await this.prisma.$transaction(async (tx) => {
      // REENVIAR un devuelto conserva su numero, su gestion y su fecha de envio:
      // es el mismo documento, corregido. Hasta el 2026-10-28 el reenvio volvia
      // a tomar MAX + 1, asi que el pedido cambiaba de numero y dejaba el
      // anterior como un hueco en la serie.
      const numeracion =
        egreso.estado === EstadoEgreso.DEVUELTO
          ? {}
          : await this.siguienteNumero(tx, egreso.almacenId);

      // Primero el cambio de estado: si dos envios del mismo pedido llegan a la
      // vez (doble clic), el segundo encuentra que ya no esta en manos del
      // solicitante y aborta.
      await this.transicionar(tx, id, egreso.estado, {
        estado: EstadoEgreso.PENDIENTE_APROBADOR,
        ...numeracion,
      });

      // Las lineas se leen DESPUES de tomar la fila del pedido: asi ninguna
      // edicion concurrente puede cambiarlas entre la validacion y el envio.
      const detalles = await tx.egresoDetalle.findMany({
        where: { egresoId: id },
        select: { ingresoDetalleId: true, cantidadSolicitada: true },
      });
      if (detalles.length === 0) {
        throw new BadRequestException(
          'El pedido no tiene ítems: elegí lo que necesitás antes de enviarlo',
        );
      }

      const lineas = detalles.map((d) => ({
        ingresoDetalleId: d.ingresoDetalleId,
        cantidadSolicitada: Number(d.cantidadSolicitada),
      }));
      await this.bloquearLotes(tx, lineas);
      await this.validarDisponibilidad(tx, lineas, egreso.almacenId, id);

      await this.registrarHistorial(
        tx,
        id,
        egreso.estado,
        EstadoEgreso.PENDIENTE_APROBADOR,
        user,
      );
    });

    return this.findOne(id, user);
  }

  /** Numero, gestion y fecha del PRIMER envio de un pedido. */
  private async siguienteNumero(
    tx: Prisma.TransactionClient,
    almacenId: number,
  ) {
    const fechaEnvio = new Date();
    const gestion = gestionDe(fechaEnvio);
    // Un envio a la vez por almacen: sin esto, dos pedidos enviados en el mismo
    // instante leen el mismo MAX y el segundo choca contra el indice unico con
    // un error 500.
    await bloquearSerie(tx, 'egresos', almacenId);
    const agg = await tx.egreso.aggregate({
      _max: { numero: true },
      where: { almacenId, gestion },
    });
    return { numero: (agg._max.numero ?? 0) + 1, gestion, fechaEnvio };
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
      await this.transicionar(tx, id, EstadoEgreso.PENDIENTE_APROBADOR, {
        estado: EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
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
   * El pedido pasa a DEVUELTO (antes volvia a BORRADOR, y se lo distinguia por
   * tener numero) y el motivo queda en el historial. Arranca una ventana NUEVA
   * de 48 h (`reservaDesde`), con el material todavia
   * reservado: el solicitante tiene ese plazo para corregir y reenviar. Antes
   * las 48 h se contaban desde la creacion, asi que conservar o perder la
   * reserva dependia de cuanto hubiera tardado el aprobador.
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
    // Cada nivel rechaza SOLO en su propio nivel: ningun egreso saltea niveles.
    // Sin esto el responsable podia rechazar un pedido que el aprobador todavia
    // no habia visto, y el aprobador uno que ya habia aprobado y estaba en el
    // almacen. admin y super_admin pueden en los dos.
    if (
      user.rol === Rol.aprobador &&
      egreso.estado !== EstadoEgreso.PENDIENTE_APROBADOR
    ) {
      throw new ForbiddenException(
        'Este pedido ya pasó tu nivel: lo tiene que resolver el almacén',
      );
    }
    if (
      user.rol === Rol.responsable_almacen &&
      egreso.estado !== EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN
    ) {
      throw new ForbiddenException(
        'Este pedido todavía espera al aprobador de unidad',
      );
    }
    if (user.rol === Rol.aprobador && user.unidadId !== egreso.unidadId) {
      throw new ForbiddenException(
        'Solo podés rechazar pedidos de tu propia unidad',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.transicionar(tx, id, egreso.estado, {
        estado: EstadoEgreso.DEVUELTO,
        // Vuelve a manos del solicitante: 48 h NUEVAS para corregirlo, con su
        // material reservado. Si no lo reenvia en ese plazo, se vacia.
        reservaDesde: new Date(),
      });
      await this.registrarHistorial(
        tx,
        id,
        egreso.estado,
        EstadoEgreso.DEVUELTO,
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
    // Tiene que venir CADA linea del pedido exactamente UNA vez. Comparar solo
    // la cantidad no alcanza: con [A, A] para un pedido A+B, el lote de A se
    // descontaba dos veces y B quedaba sin cantidad entregada.
    const recibidas = new Set(dto.lineas.map((l) => l.detalleId));
    if (recibidas.size !== dto.lineas.length) {
      throw new BadRequestException(
        'Hay una línea del pedido repetida en la entrega',
      );
    }
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
      // Lo PRIMERO: pasar a ENTREGADO solo si sigue pendiente. Una segunda
      // entrega del mismo pedido (doble clic, reintento) espera el bloqueo de
      // esta fila y, al tomarlo, ya no lo encuentra pendiente: aborta sin
      // descontar nada. Antes descontaba el lote dos veces.
      await this.transicionar(
        tx,
        id,
        EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
        {
          estado: EstadoEgreso.ENTREGADO,
          fechaEntrega: new Date(),
          entregadoPorId: user.id,
        },
      );

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
      // Igual que en la entrega: una segunda anulacion simultanea ya no lo
      // encuentra ENTREGADO y aborta. Antes devolvia el material dos veces y el
      // lote podia quedar con mas saldo del que entro.
      await this.transicionar(tx, id, EstadoEgreso.ENTREGADO, {
        estado: EstadoEgreso.ANULADO,
        anuladoPorId: user.id,
        anuladoEn: new Date(),
        motivoAnulacion: dto.motivo.trim(),
      });

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

  /**
   * Cierra un DEVUELTO (fue enviado y rechazado, ya tiene numero) que no se va
   * a reenviar. Es el equivalente de «descartar» para un pedido que ya es
   * documento: no se borra —dejaria un hueco en la serie y perderia su
   * historial— sino que queda DESISTIDO, con motivo. No toca stock (nunca salio
   * nada) y deja de reservar, porque DESISTIDO no esta entre los estados que
   * retienen.
   *
   * Lo puede hacer su solicitante, y tambien admin/super_admin: un pedido de
   * alguien que ya no esta en la institucion no tiene que quedar abierto para
   * siempre.
   */
  async desistir(id: number, dto: MotivoDto, user: AuthenticatedUser) {
    const egreso = await this.cargarParaEscritura(id, user);
    if (egreso.estado === EstadoEgreso.BORRADOR) {
      throw new BadRequestException(
        'Este pedido todavía no tiene número: se descarta, no se desiste',
      );
    }
    this.exigirEstado(egreso.estado, EstadoEgreso.DEVUELTO);
    this.exigirSolicitante(egreso.solicitanteId, user);

    await this.prisma.$transaction(async (tx) => {
      await this.transicionar(tx, id, EstadoEgreso.DEVUELTO, {
        estado: EstadoEgreso.DESISTIDO,
      });
      await this.registrarHistorial(
        tx,
        id,
        EstadoEgreso.DEVUELTO,
        EstadoEgreso.DESISTIDO,
        user,
        dto.motivo.trim(),
      );
    });

    return this.findOne(id, user);
  }

  // ---------------------------------------------------------------------------
  // Vencimiento de la reserva
  // ---------------------------------------------------------------------------

  /**
   * Vacia el pedido si su reserva de 48 h vencio sin enviarse: le quita las
   * lineas, deja el paso en el historial (sin usuario: lo hace el sistema) y
   * devuelve cuantas quito. Si no vencio, o ya estaba vacio, no hace nada y
   * devuelve 0.
   *
   * Regla del encargado (2026-10-27): si el solicitante se olvida de enviarlo,
   * el pedido queda pero sin items, y tiene que volver a elegir lo que necesita.
   *
   * La reserva YA estaba liberada antes de esto —se calcula, ver
   * `egresoReservaWhere`—, asi que vaciar no cambia el stock: hace visible lo
   * que ya paso. Por eso puede correr cada minuto sin riesgo: si el
   * proceso falla, el disponible sigue siendo correcto.
   *
   * El UPDATE condicional va primero, como en las acciones del circuito: si el
   * solicitante envia el pedido en el mismo instante, uno de los dos encuentra
   * que el otro ya actuo.
   */
  async vaciarSiVencio(id: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // Sin cambiar nada: toca la fila para tomar el bloqueo, y el `where` es la
      // condicion. El estado no cambia —un DEVUELTO vaciado sigue devuelto—.
      const { count } = await tx.egreso.updateMany({
        where: {
          id,
          estado: { in: ESTADOS_CON_RELOJ },
          reservaDesde: { lte: limiteReserva() },
          detalles: { some: {} },
        },
        data: { updatedAt: new Date() },
      });
      if (count === 0) return 0;

      const { estado } = await tx.egreso.findUniqueOrThrow({
        where: { id },
        select: { estado: true },
      });
      const { count: lineas } = await tx.egresoDetalle.deleteMany({
        where: { egresoId: id },
      });
      await tx.egresoHistorial.create({
        data: {
          egresoId: id,
          estadoAnterior: estado,
          estadoNuevo: estado,
          usuarioId: null,
          motivo:
            `Venció la reserva de ${textoDuracionReserva()} sin que el pedido se enviara: ` +
            `se ${lineas === 1 ? 'quitó 1 ítem' : `quitaron ${lineas} ítems`} y el material volvió a estar disponible.`,
        },
      });
      return lineas;
    });
  }

  /**
   * Vacia los pedidos vencidos. Cada MINUTO (era cada 10 hasta que se agrego
   * el modo de prueba de 2 min): es una consulta sobre indices que casi
   * siempre no encuentra nada, y asi el pedido se ve vacio enseguida de vencer.
   * Ver `vaciarSiVencio`.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'vaciar-reservas-vencidas' })
  async vaciarVencidos() {
    const vencidos = await this.prisma.egreso.findMany({
      where: {
        estado: { in: ESTADOS_CON_RELOJ },
        reservaDesde: { lte: limiteReserva() },
        detalles: { some: {} },
      },
      select: { id: true },
    });

    for (const { id } of vencidos) {
      // Uno que falle no frena a los demas: el siguiente ciclo lo reintenta.
      try {
        await this.vaciarSiVencio(id);
      } catch (error) {
        this.logger.error(
          `No se pudo vaciar el pedido ${id} con la reserva vencida`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Antes de editar o enviar: si la reserva vencio y el pedido todavia tenia
   * items (el proceso de cada minuto todavia no paso), se vacia en este momento y
   * se corta la accion con el motivo. El vaciado va en su propia transaccion
   * para que quede hecho aunque la accion se rechace.
   */
  private async exigirReservaVigente(id: number) {
    const quitadas = await this.vaciarSiVencio(id);
    if (quitadas > 0) {
      throw new ConflictException(
        `Venció la reserva de ${textoDuracionReserva()} sin que el pedido se enviara: ` +
          'se quitaron sus ítems y el material volvió a estar disponible. Elegí de nuevo lo que necesitás.',
      );
    }
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
    // Al solicitante le espera lo que le DEVOLVIERON para corregir. Sus pedidos
    // sin enviar tienen su propia pestaña: ahi nadie le pidio nada todavia.
    if (user.rol === Rol.solicitador) {
      return { estado: EstadoEgreso.DEVUELTO };
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
        numero: true,
        gestion: true,
        reservaDesde: true,
      },
    });
    if (!egreso) {
      throw new NotFoundException(`No existe el egreso con id ${id}`);
    }
    return egreso;
  }

  private exigirEstado(
    actual: EstadoEgreso,
    esperado: EstadoEgreso | EstadoEgreso[],
  ) {
    const validos = Array.isArray(esperado) ? esperado : [esperado];
    if (!validos.includes(actual)) {
      throw new BadRequestException(
        `El pedido está en estado ${actual} y esta acción requiere ${validos.join(' o ')}`,
      );
    }
  }

  /**
   * Cambia el pedido SOLO si sigue en el estado `desde`, y aborta si no.
   *
   * Es lo que vuelve seguras las acciones del circuito frente a un doble clic o
   * a dos usuarios a la vez. El estado se chequea antes, fuera de la
   * transaccion, para dar un mensaje claro, pero ese chequeo NO protege: dos
   * peticiones pueden pasarlo juntas. Este UPDATE condicional si, porque
   * Postgres bloquea la fila y la segunda peticion, al tomarla, vuelve a
   * evaluar el `where` contra el estado ya cambiado. Va PRIMERO en cada
   * transaccion, antes de mover stock.
   *
   * Sin `data` igual toca la fila (re-escribe el mismo estado): sirve para
   * tomar el bloqueo y confirmar el estado en una edicion de borrador.
   */
  private async transicionar(
    tx: Prisma.TransactionClient,
    id: number,
    desde: EstadoEgreso,
    data: Prisma.EgresoUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.egreso.updateMany({
      where: { id, estado: desde },
      data: { estado: desde, ...data },
    });
    if (count !== 1) {
      throw new ConflictException(
        'El pedido cambió de estado mientras tanto: actualizá la página para ver cómo quedó',
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
   *
   * Corre DENTRO de la transaccion y DESPUES de `bloquearLotes`: asi el saldo y
   * lo reservado que lee ya no pueden cambiar hasta que se grabe el pedido. Si
   * validara antes del bloqueo (como al principio), dos pedidos simultaneos
   * verian el mismo disponible y los dos lo reservarian.
   */
  private async validarDisponibilidad(
    tx: Prisma.TransactionClient,
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

    const lotes = await tx.ingresoDetalle.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        saldoCantidad: true,
        item: { select: { descripcion: true } },
        ingreso: { select: { estado: true, almacenId: true } },
      },
    });
    const porId = new Map(lotes.map((l) => [l.id, l]));
    const reservado = await reservadoPorLote(tx, ids, {
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
    // `ORDER BY id`: dos pedidos que comparten lotes los bloquean en el mismo
    // orden, asi no se quedan esperando uno al otro (deadlock).
    await tx.$queryRawUnsafe(
      `SELECT id FROM ingreso_detalles WHERE id IN (${ids.join(',')}) ORDER BY id FOR UPDATE`,
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
