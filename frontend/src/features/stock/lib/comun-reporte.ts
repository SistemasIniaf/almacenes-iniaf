import { MARGEN_PDF } from "@/lib/pdf"

import type { Content, DynamicContent } from "pdfmake/interfaces"

/**
 * Piezas comunes de los reportes de stock (detalle y consolidado): membrete,
 * pie y formatos. Los dos salen del mismo dato y tienen que verse hermanos; si
 * cada uno arma su encabezado por su cuenta, en dos cambios ya no coinciden.
 *
 * Medidas en PUNTOS (1 pulgada = 72 pt). Carta vertical: 612 x 792 pt, menos
 * 34 pt de margen por lado = 544 pt útiles.
 */

export const ANCHO_UTIL = 612 - MARGEN_PDF * 2

export const moneda = (n: number) =>
  n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const cantidad = moneda

export const precio = (n: number) =>
  n.toLocaleString("es-BO", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })

export const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

export interface DatosReporte {
  /** Almacén reportado, o `null` si son todos (reporte nacional). */
  almacen: string | null
  /** Momento de emisión: es el «AL:» del encabezado. */
  emitidoEn: Date
  /** Quién lo emitió, para el pie. */
  usuario: string
}

/** Membrete: logos a los lados y, al centro, institución + título + fecha. */
export function encabezadoReporte(
  titulo: string,
  logos: { iniaf: string; ministerio: string },
  emitidoEn: Date
): Content {
  return {
    columns: [
      { image: logos.iniaf, width: 90, alignment: "left" },
      {
        width: "*",
        stack: [
          {
            text: "INSTITUTO NACIONAL DE INNOVACIÓN AGROPECUARIA Y FORESTAL",
            fontSize: 8,
            bold: true,
          },
          { text: titulo, fontSize: 10, bold: true, margin: [0, 2, 0, 0] },
          {
            text: `AL: ${fechaCorta(emitidoEn)}`,
            fontSize: 9,
            bold: true,
            margin: [0, 1, 0, 0],
          },
        ],
        alignment: "center",
      },
      { image: logos.ministerio, width: 62, alignment: "right" },
    ],
    columnGap: 8,
  }
}

/**
 * ¿El reporte abarca TODOS los almacenes? Cuando es así, el sistema anterior lo
 * titula «NACIONAL» y saca la línea de OFICINA del encabezado — ahí tiene dos
 * entradas de menú distintas; acá es el mismo reporte sin filtrar almacén.
 */
export const esNacional = (almacen: string | null) => almacen === null

/**
 * Raya bajo el membrete y la línea de OFICINA / GESTIÓN. Con `almacen` en
 * `null` (todos) se omite la oficina, como el consolidado nacional.
 */
export function datosCabecera(
  almacen: string | null,
  emitidoEn: Date
): Content[] {
  const gestion = {
    text: [{ text: "GESTIÓN: ", bold: true }, String(emitidoEn.getFullYear())],
    fontSize: 8,
  }

  return [
    {
      canvas: [
        { type: "line", x1: 0, y1: 0, x2: ANCHO_UTIL, y2: 0, lineWidth: 1 },
      ],
      margin: [0, 4, 0, 0],
    },
    almacen === null
      ? { ...gestion, margin: [0, 6, 0, 6] }
      : {
          columns: [
            { text: [{ text: "OFICINA: ", bold: true }, almacen], fontSize: 8 },
            { ...gestion, width: 90 },
          ],
          margin: [0, 6, 0, 6],
        },
  ]
}

export function pieReporte(
  usuario: string,
  emitidoEn: Date
): DynamicContent {
  return (paginaActual, totalPaginas) => ({
    columns: [
      {
        text: `Emitido por ${usuario} el ${fechaCorta(emitidoEn)} · Sistema de almacenes INIAF`,
        fontSize: 6,
        color: "#777777",
      },
      {
        text: `Página ${paginaActual} de ${totalPaginas}`,
        fontSize: 6,
        color: "#777777",
        alignment: "right",
        width: 70,
      },
    ],
    margin: [MARGEN_PDF, 6, MARGEN_PDF, 0],
  })
}
