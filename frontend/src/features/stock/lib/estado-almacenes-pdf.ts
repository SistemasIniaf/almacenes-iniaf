import {
  cantidad,
  datosCabecera,
  encabezadoReporte,
  fechaCorta,
  moneda,
  pieReporte,
  precio,
} from "@/features/stock/lib/comun-reporte"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/features/stock/lib/comun-reporte"
import type { FilaReporteStock } from "@/features/stock/stock.types"
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «Estado de almacenes», calcado del que emitía el sistema anterior:
 * el DETALLE, agrupado por FUENTE y, dentro, por PARTIDA.
 *
 * Es la vista para **rendir** (qué hay, de cada financiador y objeto del
 * gasto), complementaria de la pantalla de stock, que es la vista para
 * **operar** (qué hay y de qué compra vino). El resumen contable, sin ítems, es
 * el otro reporte: `estado-consolidado-pdf.ts`.
 */

const TITULO = "ESTADO DE ALMACENES CONSOLIDADO"

export interface DatosReporteStock extends DatosReporte {
  filas: FilaReporteStock[]
}

export function nombreArchivoReporte(datos: DatosReporteStock): string {
  return `estado-almacenes-${datos.emitidoEn.toISOString().slice(0, 10)}.pdf`
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

  const cuerpo: TableCell[][] = [
    [
      { text: "CÓDIGO", style: "th" },
      { text: "DETALLE", style: "th" },
      { text: "UNIDAD", style: "th", alignment: "center" },
      { text: "CANTIDAD", style: "th", alignment: "right" },
      { text: "P/U", style: "th", alignment: "right" },
      { text: "VALOR", style: "th", alignment: "right" },
    ],
  ]

  const filaTotalFuente = (nombre: string, monto: number): TableCell[] => [
    {
      text: `Total ${nombre}`,
      colSpan: 5,
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {},
    {},
    {},
    {},
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
    { text: texto, colSpan: 6, ...estilo },
    {},
    {},
    {},
    {},
    {},
  ]

  // Un solo recorrido, insertando los encabezados cuando cambia la fuente o la
  // partida. Las filas ya vienen ordenadas por fuente → partida → descripción
  // desde el backend.
  let fuenteActual: string | null = null
  let partidaActual: string | null = null
  let totalFuente = 0
  let total = 0

  for (const fila of filas) {
    const fuente = fila.fuente?.nombre ?? "SIN FUENTE"
    if (fuente !== fuenteActual) {
      if (fuenteActual !== null) {
        cuerpo.push(filaTotalFuente(fuenteActual, totalFuente))
      }
      cuerpo.push(
        filaGrupo(fuente.toUpperCase(), {
          bold: true,
          fontSize: 8,
          fillColor: "#e4e4e4",
          margin: [0, 1, 0, 1],
        })
      )
      fuenteActual = fuente
      partidaActual = null
      totalFuente = 0
    }

    const partida = `${fila.item.partida.codigo} · ${fila.item.partida.denominacion}`
    if (partida !== partidaActual) {
      cuerpo.push(
        filaGrupo(partida, {
          italics: true,
          color: "#444444",
          margin: [8, 1, 0, 1],
        })
      )
      partidaActual = partida
    }

    cuerpo.push([
      { text: fila.item.codigo, noWrap: true },
      { text: fila.item.descripcion },
      { text: fila.item.unidadMedida, alignment: "center" },
      { text: cantidad(fila.cantidad), alignment: "right" },
      { text: precio(fila.precioUnitario), alignment: "right" },
      { text: moneda(fila.valor), alignment: "right" },
    ])

    totalFuente += fila.valor
    total += fila.valor
  }

  if (fuenteActual !== null) {
    cuerpo.push(filaTotalFuente(fuenteActual, totalFuente))
    cuerpo.push([
      {
        text: "TOTAL GENERAL Bs",
        colSpan: 5,
        alignment: "right",
        bold: true,
      },
      {},
      {},
      {},
      {},
      { text: moneda(total), alignment: "right", bold: true },
    ])
  }

  return {
    pageSize: "LETTER",
    pageMargins: [MARGEN_PDF, MARGEN_PDF, MARGEN_PDF, MARGEN_PDF],
    info: {
      title: `Estado de almacenes ${fechaCorta(emitidoEn)}`,
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
              widths: [58, "*", 42, 52, 54, 58],
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
