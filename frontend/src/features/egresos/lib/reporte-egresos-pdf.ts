import { ESTADO_LABEL } from "@/features/egresos/egresos.types"
import {
  ALTO_MEMBRETE,
  ANCHO_UTIL_APAISADO,
  datosCabecera,
  esNacional,
  fechaCorta,
  membreteRepetido,
  moneda,
  pieReporte,
} from "@/lib/reporte-comun"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { DatosReporte } from "@/lib/reporte-comun"
import type { FilaReporteEgreso } from "@/features/egresos/egresos.types"
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Reporte «Registro de egresos»: qué salió del almacén en un período, una línea
 * por pedido. Hermano del de ingresos — mismo membrete, mismo pie, mismas
 * reglas.
 *
 * A diferencia del de ingresos, la fila lleva **ESTADO**: un egreso puede estar
 * a mitad del circuito, y entonces su valor es lo que se estima que va a salir
 * y no lo que salió. Los ENTREGADOS son los únicos que ya movieron stock.
 *
 * Los ANULADOS no se ocultan pero tampoco suman: son documentos que existieron
 * y hay que poder rastrearlos, pero su material volvió al almacén.
 */

export interface DatosReporteEgresos extends DatosReporte {
  filas: FilaReporteEgreso[]
  /** Extremos del rango pedido (`YYYY-MM-DD`), si se filtró alguno. */
  desde?: string
  hasta?: string
}

/** Etiqueta impresa del número: 001/2026. Un borrador todavía no tiene. */
const numeroDocumento = (fila: FilaReporteEgreso) =>
  fila.numero != null && fila.gestion != null
    ? `${String(fila.numero).padStart(3, "0")}/${fila.gestion}`
    : "s/n"

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

export function nombreArchivoReporteEgresos(
  datos: DatosReporteEgresos
): string {
  const periodo = datos.desde ?? datos.emitidoEn.toISOString().slice(0, 10)
  return `registro-egresos-${periodo}.pdf`
}

export async function crearReporteEgresosPdf(datos: DatosReporteEgresos) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionReporteEgresos(datos))
}

export async function definicionReporteEgresos(
  datos: DatosReporteEgresos
): Promise<TDocumentDefinitions> {
  const logos = await logosMembrete()
  const { filas, almacen, emitidoEn, usuario, desde, hasta } = datos

  /**
   * La columna Almacén solo si el reporte abarca varios: con uno filtrado
   * repetiría el mismo nombre en cada fila y además ya está en la línea
   * «OFICINA:» de la cabecera. Igual que en el reporte de ingresos.
   */
  const conAlmacen = esNacional(almacen)
  // Nº · Nº pedido · fecha · [almacén] · unidad · solicitante · justificación ·
  // estado · total
  const COLUMNAS = conAlmacen ? 9 : 8

  const cuerpo: TableCell[][] = [
    [
      { text: "Nro", style: "th", alignment: "center" },
      { text: "Nº PEDIDO", style: "th", alignment: "center" },
      { text: "FECHA", style: "th", alignment: "center" },
      ...(conAlmacen
        ? [{ text: "ALMACÉN", style: "th", alignment: "center" } as TableCell]
        : []),
      { text: "UNIDAD", style: "th", alignment: "center" },
      { text: "SOLICITANTE", style: "th" },
      { text: "JUSTIFICACIÓN", style: "th" },
      { text: "ESTADO", style: "th", alignment: "center" },
      { text: "TOTAL Bs", style: "th", alignment: "center" },
    ],
  ]

  /** Celdas vacías que exige pdfmake por cada columna que absorbe un colSpan. */
  const relleno = (cuantas: number): TableCell[] =>
    Array.from({ length: cuantas }, () => ({}) as TableCell)

  let total = 0
  let anulados = 0
  let montoAnulado = 0

  filas.forEach((fila, indice) => {
    const monto = Number(fila.total)
    const esAnulado = fila.estado === "ANULADO"
    // Gris para toda la fila anulada: se lee de un vistazo que no cuenta.
    const color = esAnulado ? "#999999" : undefined

    if (esAnulado) {
      anulados += 1
      montoAnulado += monto
    } else {
      total += monto
    }

    cuerpo.push([
      { text: String(indice + 1), alignment: "center", color },
      { text: numeroDocumento(fila), alignment: "center", color },
      {
        // La misma fecha que muestra el listado: la de envío y, mientras es
        // borrador, la de creación.
        text: fechaIso(fila.fechaEnvio ?? fila.createdAt),
        alignment: "center",
        color,
      },
      ...(conAlmacen ? [{ text: fila.almacen.nombre, color } as TableCell] : []),
      { text: fila.unidad.sigla, alignment: "center", color },
      { text: fila.solicitante.nombre, color },
      { text: fila.justificacion, color },
      {
        text: ESTADO_LABEL[fila.estado],
        alignment: "center",
        color,
      },
      {
        // Entre paréntesis, como se anota en contabilidad lo que no suma.
        text: esAnulado ? `(${moneda(monto)})` : moneda(monto),
        alignment: "right",
        color,
      },
    ])
  })

  if (filas.length > 0) {
    cuerpo.push([
      {
        text: "TOTAL GENERAL Bs",
        colSpan: COLUMNAS - 1,
        alignment: "right",
        bold: true,
        fillColor: "#f4f4f4",
      },
      ...relleno(COLUMNAS - 2),
      {
        text: moneda(total),
        alignment: "right",
        bold: true,
        fillColor: "#f4f4f4",
      },
    ])
  }

  const notas: TableCell[] = []
  if (anulados > 0) {
    notas.push({
      text: `No se suman ${anulados} pedido${anulados === 1 ? "" : "s"} anulado${anulados === 1 ? "" : "s"} por Bs ${moneda(montoAnulado)}.`,
      fontSize: 7,
      italics: true,
      color: "#666666",
      margin: [0, 4, 0, 0],
    })
  }
  notas.push({
    text: "Los pedidos que no están entregados se valorizan por la cantidad solicitada: todavía no movieron stock.",
    fontSize: 7,
    italics: true,
    color: "#666666",
    margin: [0, anulados > 0 ? 1 : 4, 0, 0],
  })

  return {
    // Apaisada: nueve columnas no entran en el ancho de una Carta vertical.
    pageSize: "LETTER",
    pageOrientation: "landscape",
    // El margen superior le reserva el lugar al membrete, que va como `header`
    // para repetirse en todas las páginas.
    pageMargins: [
      MARGEN_PDF,
      MARGEN_PDF + ALTO_MEMBRETE,
      MARGEN_PDF,
      MARGEN_PDF,
    ],
    info: {
      title: `Registro de egresos ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    header: membreteRepetido(
      "REGISTRO DE EGRESOS DE ALMACÉN",
      logos,
      emitidoEn,
      { leyenda: leyendaPeriodo(desde, hasta), ancho: ANCHO_UTIL_APAISADO }
    ),
    content: [
      ...datosCabecera(almacen, emitidoEn),
      filas.length === 0
        ? { text: "Sin egresos para los filtros elegidos.", italics: true }
        : {
            table: {
              headerRows: 1,
              // Suman el ancho útil de la Carta apaisada (724 pt). La
              // justificación se queda con lo que sobra: es la única columna de
              // largo impredecible.
              widths: conAlmacen
                ? [20, 48, 48, 96, 44, 110, "*", 66, 58]
                : [20, 48, 48, 44, 110, "*", 66, 58],
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
      ...notas,
    ],
    footer: pieReporte(usuario, emitidoEn),
  }
}
