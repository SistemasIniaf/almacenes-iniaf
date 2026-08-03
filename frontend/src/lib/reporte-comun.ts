import { MARGEN_PDF } from "@/lib/pdf"

import type { Content, DynamicContent } from "pdfmake/interfaces"

/**
 * Piezas comunes de TODOS los reportes imprimibles: membrete, pie y formatos.
 * Los reportes salen del mismo dato y tienen que verse hermanos; si cada uno
 * arma su encabezado por su cuenta, en dos cambios ya no coinciden.
 *
 * Vivía en `features/stock/lib/` cuando solo lo usaban los dos reportes de
 * existencias. Se movió acá al sumarse el de ingresos: importar de otro feature
 * es la señal de que la pieza ya no era de ese feature.
 *
 * Medidas en PUNTOS (1 pulgada = 72 pt). Carta vertical: 612 x 792 pt, menos
 * 34 pt de margen por lado = 544 pt útiles.
 */

export const ANCHO_UTIL = 612 - MARGEN_PDF * 2

// Los formatos numéricos son los MISMOS que en pantalla (`lib/formato.ts`): un
// reporte que redondea distinto de la tabla de la que salió es un reporte que
// no cuadra. Se re-exportan para que cada PDF importe de un solo lugar.
export { cantidad, moneda, precio } from "@/lib/formato"

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

/**
 * Membrete: logos a los lados y, al centro, institución + título + fecha.
 *
 * `leyenda` reemplaza la línea «AL: …» cuando el reporte no es una foto a una
 * fecha sino un PERÍODO (ej. «DEL 01/01/2026 AL 31/12/2026»). Lo usa el reporte
 * de ingresos; los de existencias no la pasan y siguen mostrando el «AL:».
 */
export function encabezadoReporte(
  titulo: string,
  logos: { iniaf: string; ministerio: string },
  emitidoEn: Date,
  leyenda?: string
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
            text: leyenda ?? `AL: ${fechaCorta(emitidoEn)}`,
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

/** Ancho útil de una Carta APAISADA (792 - márgenes). */
export const ANCHO_UTIL_APAISADO = 792 - MARGEN_PDF * 2

/**
 * Raya bajo el membrete y la línea de OFICINA / GESTIÓN. Con `almacen` en
 * `null` (todos) se omite la oficina, como el consolidado nacional.
 *
 * `ancho` es el de la raya: por defecto el de la hoja vertical. Un reporte
 * apaisado (el de egresos) tiene que pasar `ANCHO_UTIL_APAISADO`, si no la raya
 * termina a media hoja.
 */
export function datosCabecera(
  almacen: string | null,
  emitidoEn: Date,
  ancho: number = ANCHO_UTIL
): Content[] {
  const gestion = {
    text: [{ text: "GESTIÓN: ", bold: true }, String(emitidoEn.getFullYear())],
    fontSize: 8,
  }

  return [
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: ancho, y2: 0, lineWidth: 1 }],
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
