import {
  datosCabecera,
  encabezadoReporte,
  esNacional,
  fechaCorta,
  moneda,
  pieReporte,
} from "@/lib/reporte-comun"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/lib/reporte-comun"
import type { FilaReporteIngreso } from "@/features/ingresos/ingresos.types"
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «Registro de ingresos»: qué entró al almacén en un período, una línea
 * por documento.
 *
 * A diferencia de los de existencias —que son una FOTO a una fecha— este es un
 * PERÍODO, así que el membrete lleva «DEL … AL …» en vez de «AL: …» y las filas
 * van en orden cronológico ascendente, como un libro.
 *
 * Los ANULADOS no se ocultan pero tampoco suman: un ingreso anulado es un
 * documento que existió y que hay que poder rastrear, pero su plata nunca entró.
 * Salen en gris, con el importe entre paréntesis y descontados del total, y al
 * pie se aclara cuántos fueron. Esconderlos haría que el reporte no cuadre con
 * el listado de la pantalla, que sí los muestra.
 */

export interface DatosReporteIngresos extends DatosReporte {
  filas: FilaReporteIngreso[]
  /** Extremos del rango pedido (`YYYY-MM-DD`), si se filtró alguno. */
  desde?: string
  hasta?: string
}

/** Etiqueta impresa del número: 001/2026. Sin número no debería llegar acá. */
const numeroDocumento = (fila: FilaReporteIngreso) =>
  fila.numero != null && fila.gestion != null
    ? `${String(fila.numero).padStart(3, "0")}/${fila.gestion}`
    : "—"

/** `YYYY-MM-DD` → 01/01/2026, sin que la zona horaria corra el día. */
const fechaIso = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

/**
 * «DEL … AL …» según qué extremos se hayan filtrado. Sin rango devuelve
 * `undefined` y el membrete cae en su «AL: <emisión>» de siempre.
 */
export function leyendaPeriodo(desde?: string, hasta?: string) {
  if (desde && hasta) return `DEL ${fechaIso(desde)} AL ${fechaIso(hasta)}`
  if (desde) return `DESDE EL ${fechaIso(desde)}`
  if (hasta) return `HASTA EL ${fechaIso(hasta)}`
  return undefined
}

export function nombreArchivoReporteIngresos(
  datos: DatosReporteIngresos
): string {
  const periodo = datos.desde ?? datos.emitidoEn.toISOString().slice(0, 10)
  return `registro-ingresos-${periodo}.pdf`
}

export async function crearReporteIngresosPdf(datos: DatosReporteIngresos) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionReporteIngresos(datos))
}

export async function definicionReporteIngresos(
  datos: DatosReporteIngresos
): Promise<TDocumentDefinitions> {
  const logos = await logosMembrete()
  const { filas, almacen, emitidoEn, usuario, desde, hasta } = datos

  /**
   * La columna Almacén solo tiene sentido si el reporte abarca varios: con uno
   * filtrado repetiría el mismo nombre en cada fila, y encima ya está arriba en
   * la línea «OFICINA:» de la cabecera. Misma regla que en las pantallas, donde
   * las columnas que serían siempre iguales no se muestran.
   */
  const conAlmacen = esNacional(almacen)

  const cuerpo: TableCell[][] = [
    [
      { text: "Nro", style: "th", alignment: "center" },
      { text: "Nº INGRESO", style: "th", alignment: "center" },
      { text: "FECHA", style: "th", alignment: "center" },
      ...(conAlmacen
        ? [{ text: "ALMACÉN", style: "th", alignment: "center" } as TableCell]
        : []),
      { text: "OBSERVACIÓN", style: "th", alignment: "center" },
      { text: "TOTAL Bs", style: "th", alignment: "center" },
    ],
  ]

  let total = 0
  let anulados = 0
  let montoAnulado = 0

  filas.forEach((fila, indice) => {
    const monto = Number(fila.total)
    const esAnulado = fila.estado === "ANULADO"
    // Gris para toda la fila anulada: se lee de un vistazo que no cuenta, sin
    // agregar una columna de estado que en el caso normal estaría siempre vacía.
    const color = esAnulado ? "#999999" : undefined

    if (esAnulado) {
      anulados += 1
      montoAnulado += monto
    } else {
      total += monto
    }

    cuerpo.push([
      { text: String(indice + 1), alignment: "center", color },
      {
        text: esAnulado
          ? `${numeroDocumento(fila)} (ANUL.)`
          : numeroDocumento(fila),
        alignment: "center",
        color,
      },
      { text: fechaIso(fila.fechaIngreso), alignment: "center", color },
      ...(conAlmacen ? [{ text: fila.almacen.nombre, color } as TableCell] : []),
      { text: fila.observacion ?? "", color },
      {
        // Entre paréntesis, como se anota en contabilidad lo que no suma.
        text: esAnulado ? `(${moneda(monto)})` : moneda(monto),
        alignment: "right",
        color,
      },
    ])
  })

  // Nro · Nº ingreso · fecha · [almacén] · observación · total.
  const columnas = conAlmacen ? 6 : 5

  if (filas.length > 0) {
    cuerpo.push([
      {
        text: "TOTAL GENERAL Bs",
        // Ocupa todo hasta la última columna, que es la del importe. pdfmake
        // exige tantas celdas vacías como columnas absorba, de ahí el relleno.
        colSpan: columnas - 1,
        alignment: "right",
        bold: true,
        fillColor: "#f4f4f4",
      },
      ...Array.from({ length: columnas - 2 }, () => ({}) as TableCell),
      {
        text: moneda(total),
        alignment: "right",
        bold: true,
        fillColor: "#f4f4f4",
      },
    ])
  }

  const notaAnulados =
    anulados > 0
      ? [
          {
            text: `No se suman ${anulados} ingreso${anulados === 1 ? "" : "s"} anulado${anulados === 1 ? "" : "s"} por Bs ${moneda(montoAnulado)}.`,
            fontSize: 7,
            italics: true,
            color: "#666666",
            margin: [0, 4, 0, 0] as [number, number, number, number],
          },
        ]
      : []

  return {
    pageSize: "LETTER",
    pageMargins: [MARGEN_PDF, MARGEN_PDF, MARGEN_PDF, MARGEN_PDF],
    info: {
      title: `Registro de ingresos ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    content: [
      encabezadoReporte(
        "REGISTRO DE INGRESOS A ALMACÉN",
        logos,
        emitidoEn,
        leyendaPeriodo(desde, hasta)
      ),
      ...datosCabecera(almacen, emitidoEn),
      filas.length === 0
        ? { text: "Sin ingresos para los filtros elegidos.", italics: true }
        : {
            table: {
              headerRows: 1,
              // Suman el ancho útil (544 pt): la observación se queda con lo
              // que sobra, que es la única columna de largo impredecible. Sin
              // la de almacén, esos 120 pt se los lleva ella.
              widths: conAlmacen
                ? [22, 56, 52, 120, "*", 62]
                : [22, 56, 52, "*", 62],
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
          },
      ...notaAnulados,
    ],
    footer: pieReporte(usuario, emitidoEn),
  }
}
