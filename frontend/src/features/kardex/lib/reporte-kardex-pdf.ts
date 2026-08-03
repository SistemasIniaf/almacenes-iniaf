import {
  ANCHO_UTIL_APAISADO,
  encabezadoReporte,
  fechaCorta,
  moneda,
  pieReporte,
} from "@/lib/reporte-comun"
import { cantidad, precio } from "@/lib/formato"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/lib/reporte-comun"
import type {
  BloqueReporteKardex,
  ReporteKardex,
} from "@/features/kardex/kardex.types"
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «KARDEX», calcado del que emitía el sistema anterior.
 *
 * Es una sucesión de BLOQUES, uno por ítem + fuente: cabecera con la ficha del
 * ítem, la tabla de movimientos con saldo corriente en cantidad Y en valor,
 * los totales del bloque y una línea de observaciones para anotar a mano.
 *
 * **Sale de todos los ítems del almacén**, no del que esté elegido en pantalla:
 * el kardex de pantalla es para consultar uno; el reporte, para archivar el
 * libro entero.
 *
 * Va apaisado porque son doce columnas: las de cantidad (entrada/salida/saldo)
 * y las de valor (ingreso/egreso/saldo) van por separado, como en el original —
 * el mismo movimiento se lee en unidades y en bolivianos.
 */

export interface DatosReporteKardex extends DatosReporte {
  reporte: ReporteKardex
}

export function nombreArchivoReporteKardex(datos: DatosReporteKardex): string {
  return `kardex-${datos.reporte.gestion}-${datos.emitidoEn
    .toISOString()
    .slice(0, 10)}.pdf`
}

export async function crearReporteKardexPdf(datos: DatosReporteKardex) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionReporteKardex(datos))
}

const fechaMovimiento = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

/** Ficha del ítem: lo que encabeza cada bloque. */
function cabeceraBloque(
  bloque: BloqueReporteKardex,
  almacen: string
): Content {
  const dato = (etiqueta: string, valor: string) => ({
    text: [{ text: `${etiqueta}: `, bold: true }, valor],
    fontSize: 7,
  })

  return {
    stack: [
      {
        columns: [
          dato("ALMACÉN", almacen),
          dato("CÓDIGO", bloque.item.codigo),
          dato("PARTIDA", bloque.item.partida.codigo),
          dato("UNIDAD", bloque.item.unidadMedida),
        ],
        columnGap: 6,
      },
      {
        columns: [
          { ...dato("ÍTEM", bloque.item.descripcion), width: "*" },
          {
            ...dato("FUENTE", bloque.fuente?.nombre ?? "SIN FUENTE"),
            width: 260,
          },
        ],
        columnGap: 6,
        margin: [0, 1, 0, 0],
      },
    ],
    margin: [0, 6, 0, 3],
  }
}

/** Tabla de movimientos de un bloque, con su fila de apertura y sus totales. */
function tablaBloque(bloque: BloqueReporteKardex, gestion: number): Content {
  const cuerpo: TableCell[][] = [
    [
      { text: "FECHA", style: "th", alignment: "center" },
      { text: "DOC.", style: "th", alignment: "center" },
      { text: "T", style: "th", alignment: "center" },
      { text: "DETALLE", style: "th" },
      { text: "ENTRADA", style: "th", alignment: "right" },
      { text: "SALIDA", style: "th", alignment: "right" },
      { text: "SALDO", style: "th", alignment: "right" },
      { text: "P/U", style: "th", alignment: "right" },
      { text: "INGRESO", style: "th", alignment: "right" },
      { text: "EGRESO", style: "th", alignment: "right" },
      { text: "SALDO Bs", style: "th", alignment: "right" },
    ],
  ]

  // Sin esta línea el saldo de la primera fila parece salir de la nada.
  cuerpo.push([
    {
      text: `Saldo al cierre de ${gestion - 1}`,
      colSpan: 6,
      italics: true,
      color: "#666666",
    },
    {},
    {},
    {},
    {},
    {},
    { text: cantidad(bloque.saldoInicial), alignment: "right", italics: true },
    {},
    {},
    {},
    {
      text: moneda(bloque.valorInicial),
      alignment: "right",
      italics: true,
    },
  ])

  for (const m of bloque.movimientos) {
    cuerpo.push([
      { text: fechaMovimiento(m.fecha), alignment: "center" },
      { text: m.documento ?? "—", alignment: "center" },
      { text: m.origen, alignment: "center" },
      { text: m.detalle },
      { text: m.entrada ? cantidad(m.entrada) : "", alignment: "right" },
      { text: m.salida ? cantidad(m.salida) : "", alignment: "right" },
      { text: cantidad(m.saldo), alignment: "right" },
      { text: precio(m.precioUnitario), alignment: "right" },
      {
        text: m.valorEntrada ? moneda(m.valorEntrada) : "",
        alignment: "right",
      },
      { text: m.valorSalida ? moneda(m.valorSalida) : "", alignment: "right" },
      { text: moneda(m.valorSaldo), alignment: "right" },
    ])
  }

  const { totales } = bloque
  cuerpo.push([
    {
      text: "Totales:",
      colSpan: 4,
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {},
    {},
    {},
    { text: cantidad(totales.entradas), alignment: "right", bold: true, fillColor: "#f4f4f4" },
    { text: cantidad(totales.salidas), alignment: "right", bold: true, fillColor: "#f4f4f4" },
    { text: cantidad(totales.saldo), alignment: "right", bold: true, fillColor: "#f4f4f4" },
    { text: "", fillColor: "#f4f4f4" },
    { text: moneda(totales.valorEntradas), alignment: "right", bold: true, fillColor: "#f4f4f4" },
    { text: moneda(totales.valorSalidas), alignment: "right", bold: true, fillColor: "#f4f4f4" },
    { text: moneda(totales.valorSaldo), alignment: "right", bold: true, fillColor: "#f4f4f4" },
  ])

  return {
    table: {
      headerRows: 1,
      // Suman el ancho útil de la Carta apaisada (724 pt). El detalle se queda
      // con lo que sobra: es la única columna de largo impredecible.
      widths: [44, 40, 12, "*", 44, 40, 44, 44, 52, 52, 56],
      body: cuerpo,
    },
    layout: {
      hLineWidth: () => 0.4,
      vLineWidth: () => 0.4,
      hLineColor: () => "#999999",
      vLineColor: () => "#999999",
      fillColor: (fila: number) => (fila === 0 ? "#dddddd" : null),
      paddingTop: () => 1.5,
      paddingBottom: () => 1.5,
    },
  }
}

export async function definicionReporteKardex(
  datos: DatosReporteKardex
): Promise<TDocumentDefinitions> {
  const logos = await logosMembrete()
  const { reporte, emitidoEn, usuario } = datos

  const contenido: Content[] = []

  reporte.bloques.forEach((bloque, indice) => {
    contenido.push({
      ...cabeceraBloque(bloque, reporte.almacen.nombre),
      // Cada bloque arranca en hoja nueva menos el primero: así un ítem no
      // queda partido entre dos páginas y el archivo se puede separar por ítem,
      // que es como se guardaba el kardex en papel.
      ...(indice > 0 ? { pageBreak: "before" as const } : {}),
    })
    contenido.push(tablaBloque(bloque, reporte.gestion))
    contenido.push({
      text: `Observaciones: ${"_".repeat(110)}`,
      fontSize: 7,
      color: "#666666",
      margin: [0, 6, 0, 0],
    })
  })

  return {
    // Apaisada: doce columnas no entran en una Carta vertical.
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [MARGEN_PDF, MARGEN_PDF, MARGEN_PDF, MARGEN_PDF + 6],
    info: {
      title: `Kardex ${reporte.gestion} — ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    content: [
      encabezadoReporte(
        "KARDEX DE ALMACÉN",
        logos,
        emitidoEn,
        `GESTIÓN ${reporte.gestion}`
      ),
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: ANCHO_UTIL_APAISADO,
            y2: 0,
            lineWidth: 1,
          },
        ],
        margin: [0, 4, 0, 0],
      },
      reporte.bloques.length === 0
        ? {
            text: "Sin movimientos para los filtros elegidos.",
            italics: true,
            margin: [0, 8, 0, 0],
          }
        : contenido,
    ],
    footer: pieReporte(usuario, emitidoEn),
  }
}
