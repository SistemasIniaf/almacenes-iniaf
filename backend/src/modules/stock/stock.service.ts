import { Injectable } from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import {
  almacenesPermitidos,
  filtroAlmacen,
} from '../../common/scope/almacenes-permitidos';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { reservadoPorLote } from '../../common/stock/reserva';
import { EstadoIngreso } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { QueryStockDto } from './dto/query-stock.dto';

/**
 * Consulta de existencias.
 *
 * NO hay tabla de stock: el saldo vive en cada linea de ingreso (el LOTE), y el
 * stock de un item es la suma de los saldos de sus lotes — separada por fuente
 * de financiamiento, porque cada financiador rinde su plata por separado (ver
 * CLAUDE.md y docs/decisiones-ingresos.md).
 *
 * Es solo lectura y no decide nada: de que lote sale el material al entregar es
 * una regla de EGRESOS, todavia por definir con el encargado.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Condicion que define "un lote que cuenta como stock", con los filtros de la
   * consulta ya aplicados. La comparten el listado y el selector de partidas:
   * si se separan, el selector termina ofreciendo partidas sin resultados.
   */
  private async where(query: QueryStockDto, user: AuthenticatedUser) {
    const conSaldo = query.conSaldo ?? true;

    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'items',
          ['codigo', 'descripcion'],
          query.q,
        )
      : null;

    const scope = await almacenesPermitidos(this.prisma, user);

    return {
      // Un ingreso anulado ya devolvio su saldo a cero, pero se excluye
      // explicitamente para que `conSaldo=false` tampoco lo muestre.
      ingreso: {
        estado: EstadoIngreso.CONFIRMADO,
        ...filtroAlmacen(scope, query.almacenId),
        ...(query.fuenteFinanciamientoId
          ? { fuenteFinanciamientoId: query.fuenteFinanciamientoId }
          : {}),
      },
      ...(conSaldo ? { saldoCantidad: { gt: 0 } } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.partidaId ? { item: { partidaId: query.partidaId } } : {}),
      ...(idsBusqueda ? { itemId: { in: idsBusqueda } } : {}),
    };
  }

  async findAll(query: QueryStockDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const whereLote = await this.where(query, user);

    // 1. Un renglon por item, con su saldo sumado. Se agrupa sobre los LOTES:
    //    es la unica forma de tener el saldo, no hay tabla de existencias.
    const porItem = await this.prisma.ingresoDetalle.groupBy({
      by: ['itemId'],
      where: whereLote,
      _sum: { saldoCantidad: true },
    });

    const total = porItem.length;
    if (total === 0) return paginated([], 0, page, pageSize);

    const saldoPorItem = new Map(
      porItem.map((fila) => [fila.itemId, fila._sum.saldoCantidad]),
    );

    // 2. La pagina, ordenada por descripcion. El orden sale de `items` (Prisma
    //    no ordena un groupBy por un campo de otra tabla) y desempata por id,
    //    si no dos items homonimos podrian repetirse o perderse entre paginas.
    const items = await this.prisma.item.findMany({
      where: { id: { in: [...saldoPorItem.keys()] } },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
        // La foto de catalogo: el selector de lotes del egreso la muestra para
        // que el solicitante reconozca el material sin depender de la
        // descripcion. Es una ruta relativa, no el binario.
        imagenUrl: true,
        partida: { select: { id: true, codigo: true, denominacion: true } },
      },
      // Por PARTIDA primero: asi los items de una misma partida quedan juntos y
      // la pantalla puede encabezar cada grupo, como el reporte oficial. El
      // desempate por id evita que dos homonimos se repitan entre paginas.
      orderBy: [
        { partida: { codigo: 'asc' } },
        { descripcion: 'asc' },
        { id: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 3. Los lotes, solo de los items de esta pagina.
    const lotes = await this.prisma.ingresoDetalle.findMany({
      where: { ...whereLote, itemId: { in: items.map((i) => i.id) } },
      select: {
        id: true,
        itemId: true,
        cantidad: true,
        precioUnitario: true,
        saldoCantidad: true,
        observacion: true,
        ingreso: {
          select: {
            id: true,
            numero: true,
            gestion: true,
            fechaIngreso: true,
            fechaRemision: true,
            almacen: { select: { id: true, nombre: true } },
            fuenteFinanciamiento: { select: { id: true, nombre: true } },
            proveedor: { select: { id: true, nombre: true } },
          },
        },
      },
      // Mas antiguo primero: es el orden en que se propone consumirlos. Va por
      // la fecha del INGRESO (cuando entro al almacen), no por la del documento
      // del proveedor, que se tipea a mano y puede no tener relacion con el
      // momento en que el material quedo disponible.
      orderBy: [{ ingreso: { fechaIngreso: 'asc' } }, { id: 'asc' }],
    });

    // 3-bis. Cuanto de cada lote esta comprometido por pedidos vivos. El
    // solicitante elige el LOTE al pedir, asi que necesita ver el disponible
    // real y no el saldo pelado: si no, dos pedidos se llevarian el mismo
    // material. `disponible = saldo - reservado`.
    const reservado = await reservadoPorLote(
      this.prisma,
      lotes.map((l) => l.id),
    );

    const lotesConReserva = lotes.map((lote) => {
      const enReserva = reservado.get(lote.id) ?? 0;
      return {
        ...lote,
        reservado: enReserva,
        disponible: Number(lote.saldoCantidad) - enReserva,
      };
    });

    const lotesPorItem = new Map<number, typeof lotesConReserva>();
    for (const lote of lotesConReserva) {
      const acumulado = lotesPorItem.get(lote.itemId) ?? [];
      acumulado.push(lote);
      lotesPorItem.set(lote.itemId, acumulado);
    }

    const data = items.map((item) => ({
      ...item,
      saldoTotal: saldoPorItem.get(item.id) ?? 0,
      lotes: (lotesPorItem.get(item.id) ?? []).map(
        ({ itemId: _itemId, ...lote }) => lote,
      ),
    }));

    return paginated(data, total, page, pageSize);
  }

  /**
   * Filas del reporte «Estado de almacenes», sin paginar.
   *
   * Agrupadas por PARTIDA; la fuente va como COLUMNA de cada renglon. Cada fila
   * es **item + fuente + precio + observacion** — que es el lote, sumando los
   * que comparten los cuatro. Los lotes que coinciden en todo eso son
   * indistinguibles en el papel, y separarlos solo agregaria renglones
   * repetidos.
   *
   * Se agrega aca y no en el navegador: son todas las existencias, no una
   * pagina, y el catalogo real puede dar miles de lotes.
   */
  async reporte(query: QueryStockDto, user: AuthenticatedUser) {
    const whereLote = await this.where(query, user);

    const lotes = await this.prisma.ingresoDetalle.findMany({
      where: whereLote,
      select: {
        precioUnitario: true,
        saldoCantidad: true,
        // Nota libre de la linea del ingreso ("COLOR NEGRO"). Se imprime entre
        // parentesis al lado de la descripcion, igual que en la nota de ingreso.
        observacion: true,
        item: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            unidadMedida: true,
            partida: { select: { id: true, codigo: true, denominacion: true } },
          },
        },
        ingreso: {
          select: {
            fuenteFinanciamiento: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    const filas = new Map<
      string,
      {
        item: (typeof lotes)[number]['item'];
        fuente: { id: number; nombre: string } | null;
        observacion: string | null;
        precioUnitario: number;
        cantidad: number;
      }
    >();

    // La OBSERVACION entra en la clave junto con item, fuente y precio: el
    // criterio de agrupamiento es "lo que en el papel se ve igual", y la
    // observacion se imprime. Dos lotes de botas a un mismo precio pero uno
    // "COLOR NEGRO" y otro "COLOR CAFE" son dos renglones, no uno.
    for (const lote of lotes) {
      const fuente = lote.ingreso.fuenteFinanciamiento;
      const precio = Number(lote.precioUnitario);
      const clave = `${lote.item.id}|${fuente?.id ?? 0}|${precio}|${lote.observacion ?? ''}`;
      const acumulada = filas.get(clave);
      if (acumulada) {
        acumulada.cantidad += Number(lote.saldoCantidad);
      } else {
        filas.set(clave, {
          item: lote.item,
          fuente,
          observacion: lote.observacion,
          precioUnitario: precio,
          cantidad: Number(lote.saldoCantidad),
        });
      }
    }

    // Orden: PARTIDA -> item -> fuente. La partida es el unico eje de
    // agrupamiento del reporte; la fuente es una COLUMNA de cada renglon, asi
    // que solo desempata para que un item con dos financiadores salga siempre
    // en el mismo orden. (Hasta el 2026-08-03 la fuente era el eje de arriba y
    // el reporte abria un bloque por cada una — el encargado pidio verla en
    // columna: buscar un item obligaba a recorrer todos los bloques.)
    const sinFuente = 'ZZZ'; // al final, si alguna vez falta
    return [...filas.values()]
      .map((fila) => ({
        ...fila,
        valor: fila.cantidad * fila.precioUnitario,
      }))
      .sort(
        (a, b) =>
          a.item.partida.codigo.localeCompare(b.item.partida.codigo) ||
          a.item.descripcion.localeCompare(b.item.descripcion) ||
          (a.fuente?.nombre ?? sinFuente).localeCompare(
            b.fuente?.nombre ?? sinFuente,
          ) ||
          a.precioUnitario - b.precioUnitario ||
          (a.observacion ?? '').localeCompare(b.observacion ?? ''),
      );
  }

  /**
   * Partidas que HOY tienen existencias, para el selector de la pantalla.
   *
   * No se usa el catalogo de partidas: leerlo esta reservado a admin y
   * super_admin, y quien mas mira el stock es el responsable de almacen. Ademas
   * asi el selector solo ofrece partidas con resultados.
   */
  async partidasConStock(query: QueryStockDto, user: AuthenticatedUser) {
    // Sin el filtro de partida: si no, el selector se quedaria con la elegida.
    const whereLote = await this.where(
      { ...query, partidaId: undefined },
      user,
    );

    const items = await this.prisma.ingresoDetalle.groupBy({
      by: ['itemId'],
      where: whereLote,
    });
    if (items.length === 0) return [];

    return this.prisma.partida.findMany({
      where: { items: { some: { id: { in: items.map((i) => i.itemId) } } } },
      select: { id: true, codigo: true, denominacion: true },
      orderBy: { codigo: 'asc' },
    });
  }
}
