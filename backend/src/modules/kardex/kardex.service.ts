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
import { QueryReporteKardexDto } from './dto/query-reporte-kardex.dto';

/**
 * `001-2026`, como se imprime en todos los documentos.
 *
 * **Tiene que coincidir con `numeroDocumento()` de `lib/formato.ts` del
 * frontend.** Es el UNICO numero de documento que se formatea del lado del
 * servidor, y por eso se quedo con la barra cuando el resto paso al guion: el
 * kardex manda esta columna ya armada, asi que un refactor del frontend no la
 * alcanza. Si vuelve a cambiar el formato, este es el segundo lugar a tocar.
 *
 * Se formatea aca —y no se mandan `numero` y `gestion` sueltos— porque el
 * movimiento puede venir de un ingreso O de un egreso: la columna es una
 * referencia cruzada a otro documento, no el numero del propio registro.
 */
function formatearNumero(
  numero?: number | null,
  gestion?: number | null,
): string | null {
  if (numero == null || gestion == null) return null;
  return `${String(numero).padStart(3, '0')}-${gestion}`;
}

/**
 * Los dos cortes del libro: desde donde se listan los movimientos y hasta
 * donde. Todo lo ANTERIOR a `inicio` se acumula como saldo de apertura.
 *
 * Sin rango, la ventana es la GESTION entera (del 1/1 al 31/12), que es como
 * funcionaba antes. Con rango, los extremos mandan: si se pide del 1/3 al 31/3,
 * la apertura pasa a ser el saldo AL 1/3 — que es lo correcto, un extracto de
 * marzo no abre con el saldo de enero.
 *
 * `hasta` es inclusivo (se lleva al dia siguiente y se compara con `lt`, porque
 * la fecha guardada tiene hora). Todo en UTC.
 */
function ventana(
  gestion: number,
  desde?: string,
  hasta?: string,
): { inicio: Date; fin: Date } {
  const aUtc = (valor: string, sumarDias = 0) => {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia + sumarDias));
  };

  return {
    inicio: desde ? aUtc(desde) : new Date(Date.UTC(gestion, 0, 1)),
    fin: hasta ? aUtc(hasta, 1) : new Date(Date.UTC(gestion + 1, 0, 1)),
  };
}

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
    const { inicio, fin } = ventana(gestion, query.desde, query.hasta);

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
      // El numero del EGRESO tambien: una salida sin documento en la columna
      // deja el renglon sin rastro de a que pedido pertenece.
      egreso: {
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
        // El documento que lo origino, ya formateado como se imprime. Puede ser
        // un ingreso o un egreso: un movimiento viene de UNO de los dos.
        documento:
          formatearNumero(m.ingreso?.numero, m.ingreso?.gestion) ??
          formatearNumero(m.egreso?.numero, m.egreso?.gestion),
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

  /**
   * Reporte de kardex: un BLOQUE por ITEM + FUENTE, con sus movimientos, el
   * saldo corriente y los totales del bloque. Calcado del que emitia el sistema
   * anterior.
   *
   * Dos diferencias con el kardex de PANTALLA:
   * - **Sale de todos los items del almacen**, no de uno. El `itemId` es
   *   opcional y solo sirve para acotarlo.
   * - **Separa por FUENTE aunque no se filtre.** En pantalla, sin filtro, las
   *   fuentes salen juntas (que es lo comodo para operar); en el papel cada
   *   financiador rinde su plata por separado, asi que cada uno lleva su bloque
   *   con su saldo y sus totales.
   *
   * Solo salen los bloques con algo que mostrar: movimientos en la gestion o
   * saldo que viene de antes. Un item que nunca toco este almacen no imprime
   * una hoja en blanco.
   */
  async reporte(query: QueryReporteKardexDto, user: AuthenticatedUser) {
    const almacenId = await this.resolverAlmacen(query.almacenId, user);
    const gestion = query.gestion ?? new Date().getFullYear();

    const almacen = await this.prisma.almacen.findUnique({
      where: { id: almacenId },
      select: { id: true, nombre: true },
    });
    if (!almacen) throw new NotFoundException('No existe el almacén');

    const filtroFuente = query.fuenteFinanciamientoId
      ? {
          ingresoDetalle: {
            ingreso: {
              fuenteFinanciamientoId: query.fuenteFinanciamientoId,
            },
          },
        }
      : {};

    const base = {
      almacenId,
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...filtroFuente,
    };
    const { inicio, fin } = ventana(gestion, query.desde, query.hasta);

    // Los filtros aplicados, con NOMBRE y no con id: el reporte los imprime
    // para que la hoja diga con que criterios se saco. Un reporte archivado sin
    // eso no se puede volver a reproducir ni auditar.
    const [fuenteFiltrada, itemFiltrado] = await Promise.all([
      query.fuenteFinanciamientoId
        ? this.prisma.fuenteFinanciamiento.findUnique({
            where: { id: query.fuenteFinanciamientoId },
            select: { id: true, nombre: true },
          })
        : null,
      query.itemId
        ? this.prisma.item.findUnique({
            where: { id: query.itemId },
            select: { id: true, codigo: true, descripcion: true },
          })
        : null,
    ]);

    const seleccion = {
      id: true,
      tipo: true,
      fecha: true,
      cantidad: true,
      precioUnitario: true,
      motivo: true,
      itemId: true,
      ingresoId: true,
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
          numero: true,
          gestion: true,
          proveedor: { select: { nombre: true } },
        },
      },
      egreso: {
        select: {
          numero: true,
          gestion: true,
          unidad: { select: { sigla: true, nombre: true } },
          solicitante: { select: { nombre: true } },
        },
      },
      ingresoDetalle: {
        select: {
          ingreso: {
            select: {
              fuenteFinanciamiento: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    } as const;

    const [anteriores, movimientos] = await Promise.all([
      this.prisma.movimientoKardex.findMany({
        where: { ...base, fecha: { lt: inicio } },
        select: seleccion,
      }),
      this.prisma.movimientoKardex.findMany({
        where: { ...base, fecha: { gte: inicio, lt: fin } },
        select: seleccion,
        orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      }),
    ]);

    type Movimiento = (typeof movimientos)[number];
    /** Un bloque del reporte: item + fuente. */
    const clave = (m: Movimiento) =>
      `${m.itemId}|${m.ingresoDetalle?.ingreso.fuenteFinanciamiento?.id ?? 0}`;

    const bloques = new Map<
      string,
      {
        item: Movimiento['item'];
        fuente: { id: number; nombre: string } | null;
        saldoInicial: number;
        valorInicial: number;
        movimientos: Movimiento[];
      }
    >();

    const nuevo = (m: Movimiento) => ({
      item: m.item,
      fuente: m.ingresoDetalle?.ingreso.fuenteFinanciamiento ?? null,
      saldoInicial: 0,
      valorInicial: 0,
      movimientos: [] as Movimiento[],
    });

    // Lo anterior a la gestion no se lista: se acumula como saldo de apertura,
    // en cantidad y en valor (cada movimiento con SU precio).
    for (const m of anteriores) {
      const k = clave(m);
      const bloque = bloques.get(k) ?? nuevo(m);
      const signo = this.signo(m);
      bloque.saldoInicial += signo * Number(m.cantidad);
      bloque.valorInicial +=
        signo * Number(m.cantidad) * Number(m.precioUnitario);
      bloques.set(k, bloque);
    }

    for (const m of movimientos) {
      const k = clave(m);
      const bloque = bloques.get(k) ?? nuevo(m);
      bloque.movimientos.push(m);
      bloques.set(k, bloque);
    }

    const filas = [...bloques.values()]
      // Un bloque sin movimientos en la gestion y sin saldo de apertura no
      // aporta nada al papel.
      .filter((b) => b.movimientos.length > 0 || b.saldoInicial !== 0)
      .map((bloque) => {
        let saldo = bloque.saldoInicial;
        let valor = bloque.valorInicial;
        let entradas = 0;
        let salidas = 0;
        let valorEntradas = 0;
        let valorSalidas = 0;

        const renglones = bloque.movimientos.map((m) => {
          const cantidad = Number(m.cantidad);
          const precio = Number(m.precioUnitario);
          const signo = this.signo(m);
          const monto = cantidad * precio;

          saldo += signo * cantidad;
          valor += signo * monto;
          if (signo > 0) {
            entradas += cantidad;
            valorEntradas += monto;
          } else {
            salidas += cantidad;
            valorSalidas += monto;
          }

          const documento = m.ingreso
            ? formatearNumero(m.ingreso.numero, m.ingreso.gestion)
            : formatearNumero(m.egreso?.numero, m.egreso?.gestion);

          // "I" / "E" como en el reporte anterior, mas "R" para la REVERSION.
          // Sin ese tercer valor la reversion de un egreso se imprimia como "E"
          // con la cantidad en la columna ENTRADA, que se lee como un error.
          const origen =
            m.tipo === TipoMovimiento.REVERSION
              ? 'R'
              : m.ingresoId != null
                ? 'I'
                : 'E';

          // De quien vino (entrada) o a quien fue (salida). La REVERSION suma
          // ademas su motivo: es lo unico que explica por que el renglon existe,
          // y la pantalla tambien lo muestra.
          const contraparte = m.ingreso
            ? (m.ingreso.proveedor?.nombre ?? '—')
            : m.egreso
              ? `${m.egreso.unidad.sigla} / ${m.egreso.solicitante.nombre}`
              : '—';
          const detalle =
            m.tipo === TipoMovimiento.REVERSION
              ? `REVERSIÓN · ${contraparte}${m.motivo ? ` (${m.motivo})` : ''}`
              : contraparte;

          return {
            id: m.id,
            fecha: m.fecha,
            tipo: m.tipo,
            origen,
            documento,
            detalle,
            precioUnitario: precio,
            entrada: signo > 0 ? cantidad : 0,
            salida: signo < 0 ? cantidad : 0,
            saldo,
            valorEntrada: signo > 0 ? monto : 0,
            valorSalida: signo < 0 ? monto : 0,
            valorSaldo: valor,
          };
        });

        return {
          item: bloque.item,
          fuente: bloque.fuente,
          saldoInicial: bloque.saldoInicial,
          valorInicial: bloque.valorInicial,
          movimientos: renglones,
          totales: {
            entradas,
            salidas,
            saldo,
            valorEntradas,
            valorSalidas,
            valorSaldo: valor,
          },
        };
      })
      // Por partida y descripcion, como el resto de los reportes.
      .sort(
        (a, b) =>
          a.item.partida.codigo.localeCompare(b.item.partida.codigo) ||
          a.item.descripcion.localeCompare(b.item.descripcion) ||
          (a.fuente?.nombre ?? 'ZZZ').localeCompare(b.fuente?.nombre ?? 'ZZZ'),
      );

    return {
      almacen,
      gestion,
      filtros: {
        desde: query.desde ?? null,
        hasta: query.hasta ?? null,
        fuente: fuenteFiltrada,
        item: itemFiltrado,
      },
      bloques: filas,
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
