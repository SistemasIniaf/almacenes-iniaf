import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  bloquearCierre,
  ultimaGestionCerrada,
} from '../../common/cierre/gestion-cerrada';
import { paginated } from '../../common/dto/paginated-result';
import { gestionDe, inicioDeGestion } from '../../common/fechas/zona-horaria';
import { formatearNumero } from '../../common/formato/numero-documento';
import { Prisma } from '../../generated/prisma/client';
import { EstadoEgreso, EstadoIngreso } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CerrarGestionDto } from './dto/cerrar-gestion.dto';
import { QueryCierresDto } from './dto/query-cierres.dto';
import { QueryCuadrosDto } from './dto/query-cuadros.dto';

/**
 * Pedidos que traban el cierre: los de la gestion que todavia esperan algo.
 * Para cerrar, cada pedido con numero de esa gestion tiene que estar ENTREGADO
 * o DESISTIDO (2026-11-16). Los «Pendiente de envio» no cuentan: no tienen
 * numero ni tocan el kardex.
 */
const ESTADOS_ABIERTOS: EstadoEgreso[] = [
  EstadoEgreso.PENDIENTE_APROBADOR,
  EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
  EstadoEgreso.DEVUELTO,
];

/** Cerrar un almacen grande son miles de filas de foto. */
const TIMEOUT_TRANSACCION_MS = 5 * 60 * 1000;

/**
 * Signo de un movimiento en SQL. Es `KardexService.signo` traducido: ENTRADA
 * suma, SALIDA resta, y una REVERSION depende de que revierte — la de un
 * ingreso resta (deshace una entrada) y la de un egreso suma. Si cambia alla,
 * cambia aca.
 */
const SIGNO = Prisma.sql`(CASE WHEN m.tipo = 'ENTRADA' THEN 1 WHEN m.tipo = 'SALIDA' THEN -1 WHEN m.ingreso_id IS NOT NULL THEN -1 ELSE 1 END)`;

type Db = Prisma.TransactionClient | PrismaService;

/** Una fila del Cuadro 6: un ITEM a un PRECIO (se suman sus lotes y fuentes). */
export interface FilaCuadro {
  itemId: number;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  partidaCodigo: string;
  partidaDenominacion: string;
  precio: string;
  cantInicial: string;
  cantEntradas: string;
  cantSalidas: string;
  cantFinal: string;
  valInicial: string;
  valEntradas: string;
  valSalidas: string;
  valFinal: string;
}

interface FilaFoto {
  lote: number;
  itemId: number;
  partidaId: number;
  fuenteId: number | null;
  precio: string;
  inicial: string;
  entradas: string;
  entradasTraspaso: string;
  salidas: string;
  salidasTraspaso: string;
  final: string;
}

@Injectable()
export class CierresService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Estado: que gestion le falta cerrar a cada almacen y que lo traba
  // ---------------------------------------------------------------------------

  async estado() {
    const almacenes = await this.prisma.almacen.findMany({
      select: { id: true, nombre: true, activo: true },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
    const gestionActual = gestionDe(new Date());

    const filas = await Promise.all(
      almacenes.map(async (almacen) => {
        const ultimaCerrada = await ultimaGestionCerrada(
          this.prisma,
          almacen.id,
        );
        const pendiente = await this.gestionPendiente(this.prisma, almacen);
        const pedidosAbiertos =
          pendiente == null
            ? []
            : await this.pedidosAbiertos(this.prisma, almacen.id, pendiente);
        return {
          almacen,
          ultimaCerrada,
          gestionPendiente: pendiente,
          anticipado: pendiente != null && pendiente === gestionActual,
          pedidosAbiertos,
        };
      }),
    );

    return { gestionActual, almacenes: filas };
  }

  /**
   * La gestion que le toca cerrar al almacen, o null si no tiene ninguna.
   *
   * Es la siguiente a la ultima cerrada; si nunca cerro, la de su primer
   * movimiento. Nunca una futura: la gestion EN CURSO si se puede (cierre
   * anticipado, pensado para pruebas).
   *
   * Un almacen DADO DE BAJA y vacio no tiene nada que cerrar: si no, despues de
   * vaciarlo pediria una acta en cero cada año para siempre.
   */
  private async gestionPendiente(
    db: Db,
    almacen: { id: number; activo: boolean },
  ): Promise<number | null> {
    const ultima = await ultimaGestionCerrada(db, almacen.id);
    let pendiente: number | null;
    if (ultima != null) {
      pendiente = ultima + 1;
    } else {
      const primero = await db.movimientoKardex.findFirst({
        where: { almacenId: almacen.id },
        orderBy: { fecha: 'asc' },
        select: { fecha: true },
      });
      pendiente = primero ? gestionDe(primero.fecha) : null;
    }
    if (pendiente == null || pendiente > gestionDe(new Date())) return null;

    if (!almacen.activo) {
      const desde = inicioDeGestion(pendiente);
      const movimientos = await db.movimientoKardex.count({
        where: { almacenId: almacen.id, fecha: { gte: desde } },
      });
      if (movimientos === 0) {
        const [{ saldo }] = await db.$queryRaw<{ saldo: string }[]>`
          SELECT COALESCE(SUM(${SIGNO} * m.cantidad), 0)::text AS saldo
          FROM movimientos_kardex m
          WHERE m.almacen_id = ${almacen.id} AND m.fecha < ${desde}`;
        if (Number(saldo) === 0) return null;
      }
    }
    return pendiente;
  }

  private pedidosAbiertos(db: Db, almacenId: number, gestion: number) {
    return db.egreso.findMany({
      where: { almacenId, gestion, estado: { in: ESTADOS_ABIERTOS } },
      select: {
        id: true,
        numero: true,
        gestion: true,
        estado: true,
        solicitante: { select: { nombre: true } },
      },
      orderBy: { numero: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Cerrar
  // ---------------------------------------------------------------------------

  async cerrar(dto: CerrarGestionDto, user: AuthenticatedUser) {
    const almacen = await this.prisma.almacen.findUnique({
      where: { id: dto.almacenId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!almacen) throw new NotFoundException('No existe el almacén');

    const id = await this.prisma.$transaction(
      async (tx) => {
        // Lo PRIMERO: el lock exclusivo. Espera a que terminen las operaciones
        // en vuelo de este almacen y frena las nuevas hasta el commit, asi la
        // foto no se pierde un movimiento grabado «justo antes». Y dos cierres
        // simultaneos del mismo almacen quedan en fila: el segundo ya no
        // encuentra la gestion pendiente.
        await bloquearCierre(tx, almacen.id);

        const pendiente = await this.gestionPendiente(tx, almacen);
        if (pendiente == null) {
          throw new BadRequestException(
            `El almacén ${almacen.nombre} no tiene ninguna gestión pendiente de cierre`,
          );
        }
        if (dto.gestion !== pendiente) {
          throw new ConflictException(
            `Al almacén ${almacen.nombre} le toca cerrar la gestión ${pendiente}, no la ${dto.gestion}. ` +
              'Las gestiones se cierran en orden: actualizá la página.',
          );
        }
        const anticipado = pendiente === gestionDe(new Date());
        if (anticipado && !dto.confirmarAnticipado) {
          throw new BadRequestException(
            `La gestión ${pendiente} todavía no terminó. Cerrarla deja el almacén ${almacen.nombre} ` +
              'sin poder registrar nada hasta el 1 de enero: hay que confirmarlo.',
          );
        }

        const pedidos = await this.pedidosAbiertos(tx, almacen.id, pendiente);
        if (pedidos.length > 0) {
          const lista = pedidos
            .slice(0, 10)
            .map((p) => formatearNumero(p.numero, p.gestion))
            .join(', ');
          throw new ConflictException(
            `No se puede cerrar: hay ${pedidos.length} pedido(s) de la gestión ${pendiente} sin entregar ni desistir ` +
              `(${lista}${pedidos.length > 10 ? '…' : ''}).`,
          );
        }

        const filas = await this.calcularFoto(tx, almacen.id, pendiente);

        const cierre = await tx.cierreGestion.create({
          data: {
            almacenId: almacen.id,
            gestion: pendiente,
            anticipado,
            cerradoPorId: user.id,
            valorInicial: 0,
            valorEntradas: 0,
            valorSalidas: 0,
            valorFinal: 0,
          },
          select: { id: true },
        });

        if (filas.length > 0) {
          await tx.cierreSaldo.createMany({
            data: filas.map((f) => ({
              cierreId: cierre.id,
              ingresoDetalleId: f.lote,
              itemId: f.itemId,
              partidaId: f.partidaId,
              fuenteFinanciamientoId: f.fuenteId,
              precioUnitario: f.precio,
              cantidadInicial: f.inicial,
              cantidadEntradas: f.entradas,
              cantidadEntradasTraspaso: f.entradasTraspaso,
              cantidadSalidas: f.salidas,
              cantidadSalidasTraspaso: f.salidasTraspaso,
              cantidadFinal: f.final,
            })),
          });
        }

        // Los totales se suman en la base, con aritmetica exacta: en JS el
        // producto de dos decimales ya arrastra error de punto flotante.
        const [totales] = await tx.$queryRaw<
          {
            inicial: string;
            entradas: string;
            salidas: string;
            final: string;
          }[]
        >`
          SELECT
            COALESCE(ROUND(SUM(cantidad_inicial  * precio_unitario), 2), 0)::text AS inicial,
            COALESCE(ROUND(SUM(cantidad_entradas * precio_unitario), 2), 0)::text AS entradas,
            COALESCE(ROUND(SUM(cantidad_salidas  * precio_unitario), 2), 0)::text AS salidas,
            COALESCE(ROUND(SUM(cantidad_final    * precio_unitario), 2), 0)::text AS final
          FROM cierre_saldos WHERE cierre_id = ${cierre.id}`;
        await tx.cierreGestion.update({
          where: { id: cierre.id },
          data: {
            valorInicial: totales.inicial,
            valorEntradas: totales.entradas,
            valorSalidas: totales.salidas,
            valorFinal: totales.final,
          },
        });

        return cierre.id;
      },
      { timeout: TIMEOUT_TRANSACCION_MS, maxWait: 30_000 },
    );

    return this.findOne(id);
  }

  /**
   * La FOTO de la gestion: por cada lote del almacen, cuanto tenia al 01/01,
   * cuanto entro y salio en la gestion y cuanto quedo al 31/12.
   *
   * Sale del KARDEX y no del saldo de los lotes: el cierre se puede hacer meses
   * despues, cuando las entregas de la gestion siguiente ya bajaron el saldo.
   * Solo cuentan los movimientos fechados antes del 1/1 siguiente.
   *
   * - La carga de SALDOS INICIALES (y su anulacion) va al saldo inicial, no a
   *   entradas: no es una compra del año.
   * - Una anulacion se NETEA contra su columna (la de un ingreso resta de
   *   entradas, la de un egreso resta de salidas): un documento anulado no
   *   infla las dos columnas a la vez.
   * - Los traspasos estan DENTRO de entradas/salidas y ademas se guardan
   *   aparte, para descontarlos en el cuadro institucional.
   *
   * Solo los lotes con algo que mostrar: un lote que ya estaba en cero y no se
   * movio no aporta nada al acta.
   */
  private async calcularFoto(
    tx: Prisma.TransactionClient,
    almacenId: number,
    gestion: number,
  ): Promise<FilaFoto[]> {
    const desde = inicioDeGestion(gestion);
    const hasta = inicioDeGestion(gestion + 1);

    // `en_gestion` y `es_inicial` se calculan una vez por movimiento y se usan
    // en cada columna.
    return tx.$queryRaw<FilaFoto[]>`
      WITH mov AS (
        SELECT
          m.ingreso_detalle_id AS lote,
          m.tipo::text AS tipo,
          m.traspaso_id IS NOT NULL AS es_traspaso,
          m.ingreso_id IS NOT NULL AS de_ingreso,
          ${SIGNO} * m.cantidad AS cant,
          m.fecha >= ${desde} AS en_gestion,
          COALESCE(im.saldo_inicial, false) AS es_inicial
        FROM movimientos_kardex m
        LEFT JOIN ingresos im ON im.id = m.ingreso_id
        WHERE m.almacen_id = ${almacenId}
          AND m.fecha < ${hasta}
          AND m.ingreso_detalle_id IS NOT NULL
      ),
      lotes AS (
        SELECT
          lote,
          SUM(CASE WHEN NOT en_gestion OR es_inicial THEN cant ELSE 0 END) AS inicial,
          SUM(CASE WHEN en_gestion AND NOT es_inicial
                    AND (tipo = 'ENTRADA' OR (tipo = 'REVERSION' AND de_ingreso))
                   THEN cant ELSE 0 END) AS entradas,
          SUM(CASE WHEN en_gestion AND tipo = 'ENTRADA' AND es_traspaso
                   THEN cant ELSE 0 END) AS entradas_traspaso,
          SUM(CASE WHEN en_gestion AND NOT es_inicial
                    AND (tipo = 'SALIDA' OR (tipo = 'REVERSION' AND NOT de_ingreso))
                   THEN -cant ELSE 0 END) AS salidas,
          SUM(CASE WHEN en_gestion AND tipo = 'SALIDA' AND es_traspaso
                   THEN -cant ELSE 0 END) AS salidas_traspaso,
          SUM(cant) AS final
        FROM mov
        GROUP BY lote
      )
      SELECT
        l.lote,
        d.item_id AS "itemId",
        it.partida_id AS "partidaId",
        i.fuente_financiamiento_id AS "fuenteId",
        d.precio_unitario::text AS precio,
        l.inicial::text AS inicial,
        l.entradas::text AS entradas,
        l.entradas_traspaso::text AS "entradasTraspaso",
        l.salidas::text AS salidas,
        l.salidas_traspaso::text AS "salidasTraspaso",
        l.final::text AS final
      FROM lotes l
      JOIN ingreso_detalles d ON d.id = l.lote
      JOIN ingresos i ON i.id = d.ingreso_id
      JOIN items it ON it.id = d.item_id
      WHERE l.inicial <> 0 OR l.entradas <> 0 OR l.salidas <> 0 OR l.final <> 0
      ORDER BY l.lote`;
  }

  // ---------------------------------------------------------------------------
  // Cuadros 5 y 6 (DGCF R1.05 / R1.06)
  // ---------------------------------------------------------------------------

  /** Gestiones con algun cierre, de la mas reciente a la mas vieja. */
  async gestiones() {
    const filas = await this.prisma.cierreGestion.groupBy({
      by: ['gestion'],
      _count: { _all: true },
      orderBy: { gestion: 'desc' },
    });
    return filas.map((f) => ({
      gestion: f.gestion,
      almacenesCerrados: f._count._all,
    }));
  }

  /**
   * Los datos de los Cuadros 5 y 6 de una gestion. Salen de la FOTO de los
   * cierres, nunca del stock del dia: asi el cuadro se reimprime igual.
   *
   * - Con `almacenId`: el cuadro de ese almacen (tiene que haberla cerrado).
   *   Los traspasos cuentan como entradas y salidas, porque para ESE almacen lo
   *   son.
   * - Sin `almacenId`: el INSTITUCIONAL, la suma de todos los almacenes que
   *   cerraron. Los traspasos se DESCUENTAN de entradas y salidas: el material
   *   no entro ni salio de la institucion, solo cambio de almacen. Es
   *   PROVISIONAL mientras algun almacen tenga esa gestion sin cerrar (se
   *   devuelven en `pendientes`).
   *
   * Una fila por ITEM + PRECIO (decision 2026-11-16): las fuentes y los lotes
   * del mismo item al mismo precio se suman. El Cuadro 5 es el mismo dato
   * agrupado por partida, asi que lo arma el frontend sumando estas filas: los
   * dos cuadros cuadran por construccion.
   *
   * Los valores se calculan en la base (aritmetica exacta) y se redondean a
   * centavos por fila.
   */
  async cuadros(query: QueryCuadrosDto) {
    const { gestion, almacenId } = query;

    const cierres = await this.prisma.cierreGestion.findMany({
      where: { gestion, ...(almacenId ? { almacenId } : {}) },
      select: {
        id: true,
        anticipado: true,
        cerradoEn: true,
        almacen: { select: { id: true, nombre: true } },
      },
      orderBy: { almacen: { nombre: 'asc' } },
    });

    if (cierres.length === 0) {
      if (almacenId) {
        const almacen = await this.prisma.almacen.findUnique({
          where: { id: almacenId },
          select: { nombre: true },
        });
        if (!almacen) throw new NotFoundException('No existe el almacén');
        throw new NotFoundException(
          `El almacén ${almacen.nombre} todavía no cerró la gestión ${gestion}`,
        );
      }
      throw new NotFoundException(
        `Ningún almacén cerró todavía la gestión ${gestion}`,
      );
    }

    // Solo el institucional puede quedar provisional: el de un almacen sale
    // de SU cierre, que ya esta hecho.
    const pendientes = almacenId ? [] : await this.almacenesSinCerrar(gestion);
    const neto = !almacenId;
    const ids = cierres.map((c) => c.id);

    const entradas = neto
      ? Prisma.sql`s.cantidad_entradas - s.cantidad_entradas_traspaso`
      : Prisma.sql`s.cantidad_entradas`;
    const salidas = neto
      ? Prisma.sql`s.cantidad_salidas - s.cantidad_salidas_traspaso`
      : Prisma.sql`s.cantidad_salidas`;

    const filas = await this.prisma.$queryRaw<FilaCuadro[]>`
      WITH f AS (
        SELECT
          s.item_id, s.partida_id, s.precio_unitario,
          SUM(s.cantidad_inicial) AS inicial,
          SUM(${entradas}) AS entradas,
          SUM(${salidas}) AS salidas,
          SUM(s.cantidad_final) AS final
        FROM cierre_saldos s
        WHERE s.cierre_id IN (${Prisma.join(ids)})
        GROUP BY s.item_id, s.partida_id, s.precio_unitario
      )
      SELECT
        it.id AS "itemId",
        it.codigo,
        it.descripcion,
        it.unidad_medida AS "unidadMedida",
        p.codigo AS "partidaCodigo",
        p.denominacion AS "partidaDenominacion",
        f.precio_unitario::text AS precio,
        f.inicial::text AS "cantInicial",
        f.entradas::text AS "cantEntradas",
        f.salidas::text AS "cantSalidas",
        f.final::text AS "cantFinal",
        ROUND(f.inicial * f.precio_unitario, 2)::text AS "valInicial",
        ROUND(f.entradas * f.precio_unitario, 2)::text AS "valEntradas",
        ROUND(f.salidas * f.precio_unitario, 2)::text AS "valSalidas",
        ROUND(f.final * f.precio_unitario, 2)::text AS "valFinal"
      FROM f
      JOIN items it ON it.id = f.item_id
      JOIN partidas p ON p.id = f.partida_id
      WHERE f.inicial <> 0 OR f.entradas <> 0 OR f.salidas <> 0 OR f.final <> 0
      ORDER BY p.codigo, it.descripcion, it.id, f.precio_unitario`;

    return {
      gestion,
      almacen: almacenId ? cierres[0].almacen : null,
      provisional: pendientes.length > 0,
      pendientes,
      cierres: cierres.map((c) => ({
        almacen: c.almacen,
        anticipado: c.anticipado,
        cerradoEn: c.cerradoEn,
      })),
      filas,
    };
  }

  /**
   * Almacenes que todavia deben la gestion: su pendiente es esa o una
   * anterior. Uno sin movimientos, o dado de baja y vacio, no debe nada.
   */
  private async almacenesSinCerrar(gestion: number) {
    const almacenes = await this.prisma.almacen.findMany({
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: 'asc' },
    });
    const resultado: { id: number; nombre: string }[] = [];
    for (const almacen of almacenes) {
      const pendiente = await this.gestionPendiente(this.prisma, almacen);
      if (pendiente != null && pendiente <= gestion) {
        resultado.push({ id: almacen.id, nombre: almacen.nombre });
      }
    }
    return resultado;
  }

  // ---------------------------------------------------------------------------
  // Consulta
  // ---------------------------------------------------------------------------

  async findAll(query: QueryCierresDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CierreGestionWhereInput = {
      ...(query.almacenId ? { almacenId: query.almacenId } : {}),
      ...(query.gestion ? { gestion: query.gestion } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.cierreGestion.findMany({
        where,
        select: cierreSelect,
        orderBy: [{ cerradoEn: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cierreGestion.count({ where }),
    ]);
    return paginated(data, total, page, pageSize);
  }

  /**
   * Un cierre con su foto entera y el conteo de documentos de la gestion: es
   * todo lo que necesita el acta. Siempre sale de lo GUARDADO, no del stock del
   * dia, asi el acta se puede volver a imprimir igual años despues.
   */
  async findOne(id: number) {
    const cierre = await this.prisma.cierreGestion.findUnique({
      where: { id },
      select: {
        ...cierreSelect,
        saldos: {
          select: {
            id: true,
            ingresoDetalleId: true,
            precioUnitario: true,
            cantidadInicial: true,
            cantidadEntradas: true,
            cantidadEntradasTraspaso: true,
            cantidadSalidas: true,
            cantidadSalidasTraspaso: true,
            cantidadFinal: true,
            item: {
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                unidadMedida: true,
              },
            },
            partida: {
              select: { id: true, codigo: true, denominacion: true },
            },
            fuenteFinanciamiento: { select: { id: true, nombre: true } },
          },
          orderBy: [{ partida: { codigo: 'asc' } }, { id: 'asc' }],
        },
      },
    });
    if (!cierre) throw new NotFoundException(`No existe el cierre ${id}`);

    return {
      ...cierre,
      documentos: await this.documentosDeLaGestion(
        cierre.almacen.id,
        cierre.gestion,
      ),
    };
  }

  /** Cuantos documentos tuvo la gestion en ese almacen, para el acta. */
  private async documentosDeLaGestion(almacenId: number, gestion: number) {
    const [ingresos, egresos, enviados, recibidos] = await Promise.all([
      this.prisma.ingreso.groupBy({
        by: ['estado'],
        where: {
          almacenId,
          gestion,
          traspasoId: null,
          saldoInicial: false,
        },
        _count: { _all: true },
      }),
      this.prisma.egreso.groupBy({
        by: ['estado'],
        where: { almacenId, gestion },
        _count: { _all: true },
      }),
      this.prisma.traspaso.count({
        where: { almacenOrigenId: almacenId, gestion },
      }),
      this.prisma.traspaso.count({
        where: { almacenDestinoId: almacenId, gestion },
      }),
    ]);
    const deIngreso = (e: EstadoIngreso) =>
      ingresos.find((g) => g.estado === e)?._count._all ?? 0;
    const deEgreso = (e: EstadoEgreso) =>
      egresos.find((g) => g.estado === e)?._count._all ?? 0;
    return {
      ingresosConfirmados: deIngreso(EstadoIngreso.CONFIRMADO),
      ingresosAnulados: deIngreso(EstadoIngreso.ANULADO),
      egresosEntregados: deEgreso(EstadoEgreso.ENTREGADO),
      egresosAnulados: deEgreso(EstadoEgreso.ANULADO),
      egresosDesistidos: deEgreso(EstadoEgreso.DESISTIDO),
      traspasosEnviados: enviados,
      traspasosRecibidos: recibidos,
    };
  }
}

const cierreSelect = {
  id: true,
  gestion: true,
  anticipado: true,
  cerradoEn: true,
  valorInicial: true,
  valorEntradas: true,
  valorSalidas: true,
  valorFinal: true,
  almacen: { select: { id: true, nombre: true } },
  cerradoPor: { select: { id: true, nombre: true, usuario: true } },
} satisfies Prisma.CierreGestionSelect;
