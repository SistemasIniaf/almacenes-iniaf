import {
  cantidad,
  datosCabecera,
  encabezadoReporte,
  fechaCorta,
  moneda,
  pieReporte,
  precio,
} from "@/lib/reporte-comun"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/lib/reporte-comun"
import type { FilaReporteStock } from "@/features/stock/stock.types"
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «Estado de almacenes consolidado por ÍTEM»: el DETALLE, agrupado por
 * PARTIDA, con la FUENTE como columna de cada renglón.
 *
 * Es la vista para **rendir** (qué hay, de cada financiador y objeto del
 * gasto), complementaria de la pantalla de stock, que es la vista para
 * **operar** (qué hay y de qué compra vino). El resumen contable, sin ítems, es
 * el otro reporte: `estado-consolidado-pdf.ts`.
 *
 * **La fuente era un bloque y pasó a ser columna** (2026-08-03, pedido del
 * encargado). El sistema anterior abría una sección por financiador y repetía
 * las partidas dentro de cada una, así que un ítem comprado con tres fuentes
 * aparecía en tres lugares distintos del papel y encontrarlo obligaba a
 * recorrerlo entero. Con la fuente en columna, cada ítem sale una sola vez por
 * partida y sus financiadores quedan uno debajo del otro. Los totales no
 * cambian: es la misma plata reagrupada, y sigue cuadrando con el consolidado.
 */

/** Nombre oficial del reporte (lo fijó la institución el 2026-08-03). */
const TITULO = "ESTADO DE ALMACENES CONSOLIDADO POR ÍTEM"

export interface DatosReporteStock extends DatosReporte {
  filas: FilaReporteStock[]
}

export function nombreArchivoReporte(datos: DatosReporteStock): string {
  return `estado-almacenes-por-item-${datos.emitidoEn.toISOString().slice(0, 10)}.pdf`
}

export async function crearEstadoAlmacenesPdf(datos: DatosReporteStock) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionEstadoAlmacenes(datos))
}

export async function definicionEstadoAlmacenes(
  datos: DatosReporteStock
): Promise<TDocumentDefinitions> {
  const logos = await logosMembrete()
  const { filas, almacen, emitidoEn, usuario } = datos

  // CÓDIGO · DETALLE · FUENTE · UNIDAD · CANTIDAD · P/U · VALOR
  const COLUMNAS = 7

  const cuerpo: TableCell[][] = [
    [
      { text: "CÓDIGO", style: "th" },
      { text: "DETALLE", style: "th" },
      { text: "FUENTE FIN.", style: "th" },
      { text: "UNIDAD", style: "th", alignment: "center" },
      { text: "CANTIDAD", style: "th", alignment: "right" },
      { text: "P/U", style: "th", alignment: "right" },
      { text: "VALOR", style: "th", alignment: "right" },
    ],
  ]

  /** Celdas vacías que exige pdfmake por cada columna que absorbe un colSpan. */
  const relleno = (cuantas: number): TableCell[] =>
    Array.from({ length: cuantas }, () => ({}) as TableCell)

  const filaSubtotal = (etiqueta: string, monto: number): TableCell[] => [
    {
      text: etiqueta,
      colSpan: COLUMNAS - 1,
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    ...relleno(COLUMNAS - 2),
    {
      text: moneda(monto),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
  ]

  // El estilo va tipado explícito: `Partial<TableCell>` no sirve porque
  // `TableCell` es una unión que incluye la celda vacía `{}`.
  const filaGrupo = (
    texto: string,
    estilo: {
      bold?: boolean
      italics?: boolean
      fontSize?: number
      color?: string
      fillColor?: string
      margin?: [number, number, number, number]
    }
  ): TableCell[] => [
    { text: texto, colSpan: COLUMNAS, ...estilo },
    ...relleno(COLUMNAS - 1),
  ]

  // Un solo recorrido, abriendo un encabezado cada vez que cambia la partida.
  // Las filas ya vienen ordenadas por partida → ítem → fuente desde el backend.
  let partidaActual: string | null = null
  let totalPartida = 0
  let total = 0

  for (const fila of filas) {
    const partida = `${fila.item.partida.codigo} · ${fila.item.partida.denominacion}`
    if (partida !== partidaActual) {
      if (partidaActual !== null) {
        cuerpo.push(filaSubtotal("Subtotal partida:", totalPartida))
      }
      cuerpo.push(
        filaGrupo(partida.toUpperCase(), {
          bold: true,
          fontSize: 8,
          fillColor: "#e4e4e4",
          margin: [0, 1, 0, 1],
        })
      )
      partidaActual = partida
      totalPartida = 0
    }

    cuerpo.push([
      { text: fila.item.codigo, noWrap: true },
      {
        // La observación de la línea del ingreso se imprime pegada a la
        // descripción, igual que en la nota de ingreso: "BOTAS DE AGUA
        // (COLOR NEGRO)". Es lo que distingue dos lotes del mismo ítem.
        text: fila.observacion
          ? `${fila.item.descripcion} (${fila.observacion})`
          : fila.item.descripcion,
      },
      { text: fila.fuente?.nombre ?? "SIN FUENTE" },
      { text: fila.item.unidadMedida, alignment: "center" },
      { text: cantidad(fila.cantidad), alignment: "right" },
      { text: precio(fila.precioUnitario), alignment: "right" },
      { text: moneda(fila.valor), alignment: "right" },
    ])

    totalPartida += fila.valor
    total += fila.valor
  }

  if (partidaActual !== null) {
    cuerpo.push(filaSubtotal("Subtotal partida:", totalPartida))
    cuerpo.push([
      {
        text: "TOTAL GENERAL Bs",
        colSpan: COLUMNAS - 1,
        alignment: "right",
        bold: true,
      },
      ...relleno(COLUMNAS - 2),
      { text: moneda(total), alignment: "right", bold: true },
    ])
  }

  return {
    pageSize: "LETTER",
    pageMargins: [MARGEN_PDF, MARGEN_PDF, MARGEN_PDF, MARGEN_PDF],
    info: {
      title: `Estado de almacenes por ítem ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    content: [
      encabezadoReporte(TITULO, logos, emitidoEn),
      ...datosCabecera(almacen, emitidoEn),
      filas.length === 0
        ? { text: "Sin existencias para los filtros elegidos.", italics: true }
        : {
            table: {
              headerRows: 1,
              // Suman el ancho útil (544 pt). La fuente se lleva 88: los
              // nombres largos («DNPS-RECURSOS ESPECÍFICOS») parten en dos
              // líneas, que es preferible a robarle ancho al detalle.
              widths: [56, "*", 88, 38, 48, 50, 56],
              body: cuerpo,
            },
            layout: {
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => "#999999",
              vLineColor: () => "#999999",
              fillColor: (fila) => (fila === 0 ? "#dddddd" : null),
              paddingTop: () => 1.5,
              paddingBottom: () => 1.5,
            },
          },
    ],
    footer: pieReporte(usuario, emitidoEn),
  }
}
