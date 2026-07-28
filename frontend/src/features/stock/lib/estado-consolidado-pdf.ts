import {
  datosCabecera,
  esNacional,
  encabezadoReporte,
  fechaCorta,
  moneda,
  pieReporte,
} from "@/features/stock/lib/comun-reporte"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/features/stock/lib/comun-reporte"
import type { FilaReporteStock } from "@/features/stock/stock.types"
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «Estado consolidado de almacenes y suministros», calcado del que
 * emitía el sistema anterior.
 *
 * Es el **resumen contable**: no lista ítems, solo cuánta plata hay parada por
 * PARTIDA (el objeto del gasto) y, dentro, por FUENTE (el financiador), con
 * subtotal por partida. Sale del mismo dato que el reporte de detalle —una
 * reagrupación, no otra consulta— así que los dos siempre cuadran.
 */

/**
 * El sistema anterior tiene DOS entradas de menú para esto, que solo se
 * diferencian en el alcance: una oficina o todas. Acá es el mismo reporte, y el
 * título acompaña según se haya filtrado un almacén o no.
 */
const titulo = (almacen: string | null) =>
  esNacional(almacen)
    ? "ESTADO CONSOLIDADO NACIONAL DE ALMACENES Y SUMINISTROS"
    : "ESTADO CONSOLIDADO DE ALMACENES Y SUMINISTROS"

export interface DatosConsolidado extends DatosReporte {
  filas: FilaReporteStock[]
}

export function nombreArchivoConsolidado(datos: DatosConsolidado): string {
  const alcance = esNacional(datos.almacen) ? "nacional-" : ""
  return `estado-consolidado-${alcance}${datos.emitidoEn.toISOString().slice(0, 10)}.pdf`
}

export async function crearEstadoConsolidadoPdf(datos: DatosConsolidado) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionEstadoConsolidado(datos))
}

/** Suma los valores por partida + fuente; el ítem se descarta. */
function agrupar(filas: FilaReporteStock[]) {
  const grupos = new Map<
    string,
    {
      partida: FilaReporteStock["item"]["partida"]
      fuente: string
      valor: number
    }
  >()

  for (const fila of filas) {
    const fuente = fila.fuente?.nombre ?? "SIN FUENTE"
    const clave = `${fila.item.partida.id}|${fuente}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.valor += fila.valor
    else
      grupos.set(clave, {
        partida: fila.item.partida,
        fuente,
        valor: fila.valor,
      })
  }

  // Por partida (que es el eje del reporte) y, dentro, por fuente.
  return [...grupos.values()].sort(
    (a, b) =>
      a.partida.codigo.localeCompare(b.partida.codigo) ||
      a.fuente.localeCompare(b.fuente)
  )
}

export async function definicionEstadoConsolidado(
  datos: DatosConsolidado
): Promise<TDocumentDefinitions> {
  const logos = await logosMembrete()
  const { filas, almacen, emitidoEn, usuario } = datos
  const grupos = agrupar(filas)

  const cuerpo: TableCell[][] = [
    [
      { text: "Nro", style: "th", alignment: "center" },
      { text: "DESCRIPCIÓN", style: "th", alignment: "center" },
      { text: "PARTIDA", style: "th", alignment: "center" },
      { text: "FUENTE FIN.", style: "th", alignment: "center" },
      { text: "VALOR", style: "th", alignment: "center" },
    ],
  ]

  const subtotal = (monto: number): TableCell[] => [
    {
      text: "Subtotal:",
      colSpan: 4,
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
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

  let partidaActual: string | null = null
  let acumuladoPartida = 0
  let total = 0
  let numero = 0

  for (const grupo of grupos) {
    if (partidaActual !== null && grupo.partida.codigo !== partidaActual) {
      cuerpo.push(subtotal(acumuladoPartida))
      acumuladoPartida = 0
    }
    partidaActual = grupo.partida.codigo

    numero += 1
    cuerpo.push([
      { text: String(numero), alignment: "center" },
      { text: grupo.partida.denominacion },
      { text: grupo.partida.codigo, alignment: "center" },
      { text: grupo.fuente },
      { text: moneda(grupo.valor), alignment: "right" },
    ])

    acumuladoPartida += grupo.valor
    total += grupo.valor
  }

  if (partidaActual !== null) {
    cuerpo.push(subtotal(acumuladoPartida))
    cuerpo.push([
      {
        text: "TOTAL GENERAL Bs",
        colSpan: 4,
        alignment: "right",
        bold: true,
      },
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
      title: `${esNacional(almacen) ? "Estado consolidado nacional" : "Estado consolidado"} ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    content: [
      encabezadoReporte(titulo(almacen), logos, emitidoEn),
      ...datosCabecera(almacen, emitidoEn),
      grupos.length === 0
        ? { text: "Sin existencias para los filtros elegidos.", italics: true }
        : {
            table: {
              headerRows: 1,
              widths: [24, "*", 46, 96, 68],
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
