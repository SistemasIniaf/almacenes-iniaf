import {
  agruparCuadro5,
  alcance,
  avisoAnticipado,
  avisoProvisional,
  CUADRO,
  ENTIDAD,
  nombreBase,
  NOTAS_MINISTERIO,
  totalesCuadro6,
  VERSION,
} from "@/features/cierres/lib/cuadros"
import { cantidad, moneda, precio } from "@/lib/formato"
import {
  cargarPdfMake,
  columnaLogo,
  logosMembrete,
  MARGEN_PDF,
} from "@/lib/pdf"

import type { DatosCuadros } from "@/features/cierres/cierres.types"
import type { NumeroCuadro } from "@/features/cierres/lib/cuadros"
import type {
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

/**
 * Cuadros 5 y 6 en PDF, con el membrete de la planilla del Ministerio: logo de
 * la entidad, código DGCF y versión a la derecha, entidad, título, «Al 31 de
 * diciembre» y «(Expresado en Bolivianos)». El 5 va en Carta vertical (6
 * columnas); el 6, apaisado (12 columnas). Sin firmas: las pide el formulario
 * oficial, no este modelo.
 */

const MARGEN = MARGEN_PDF

const LAYOUT: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#888888",
  vLineColor: () => "#888888",
  paddingTop: () => 2.5,
  paddingBottom: () => 2.5,
}

const der = (text: string, extra: Partial<TableCell & object> = {}) =>
  ({ text, alignment: "right", ...extra }) as TableCell

async function membrete(
  numero: NumeroCuadro,
  datos: DatosCuadros,
  anchoUtil: number
): Promise<Content[]> {
  const { iniaf } = await logosMembrete()
  const provisional = avisoProvisional(datos)
  const anticipado = avisoAnticipado(datos)
  return [
    {
      columns: [
        columnaLogo(iniaf, [99, 43], "left"),
        {
          width: "*",
          stack: [
            { text: ENTIDAD, bold: true, fontSize: 9.5 },
            {
              text: CUADRO[numero].titulo,
              bold: true,
              fontSize: 11,
              margin: [0, 3, 0, 0],
            },
            {
              text: `Al 31 de diciembre de ${datos.gestion}`,
              fontSize: 9,
              margin: [0, 2, 0, 0],
            },
            { text: "(Expresado en Bolivianos)", fontSize: 8 },
          ],
          alignment: "center",
        },
        {
          width: 99,
          stack: [
            { text: CUADRO[numero].codigo, bold: true, fontSize: 8.5 },
            { text: VERSION, fontSize: 8 },
          ],
          alignment: "right",
        },
      ],
      columnGap: 8,
    },
    {
      canvas: [
        { type: "line", x1: 0, y1: 0, x2: anchoUtil, y2: 0, lineWidth: 1 },
      ],
      margin: [0, 6, 0, 0],
    },
    { text: alcance(datos), bold: true, fontSize: 8.5, margin: [0, 6, 0, 0] },
    ...(provisional
      ? [
          {
            text: provisional,
            bold: true,
            fontSize: 8,
            color: "#b00020",
            margin: [0, 3, 0, 0],
          } as Content,
        ]
      : []),
    ...(anticipado
      ? [
          {
            text: anticipado,
            fontSize: 7.5,
            color: "#8a5a00",
            margin: [0, 3, 0, 0],
          } as Content,
        ]
      : []),
  ]
}

function notas(): Content {
  return {
    stack: [
      ...NOTAS_MINISTERIO.map((n) => ({
        text: n,
        fontSize: 7,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      })),
    ],
    margin: [0, 10, 0, 0],
    unbreakable: true,
  }
}

function documento(
  numero: NumeroCuadro,
  datos: DatosCuadros,
  apaisado: boolean,
  contenido: Content[]
): TDocumentDefinitions {
  const emitido = new Date()
  return {
    pageSize: "LETTER",
    pageOrientation: apaisado ? "landscape" : "portrait",
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    info: {
      title: `Cuadro ${numero} — ${CUADRO[numero].titulo} ${datos.gestion}`,
      creator: "Sistema de almacenes INIAF",
    },
    // El PROVISIONAL va también de marca de agua: el papel suelto tiene que
    // decirlo aunque nadie lea el renglón de arriba.
    ...(datos.provisional
      ? {
          watermark: {
            text: "PROVISIONAL",
            color: "#cc0000",
            opacity: 0.08,
            bold: true,
          },
        }
      : {}),
    defaultStyle: { font: "Helvetica", fontSize: 7.5, lineHeight: 1.1 },
    styles: { th: { bold: true, fontSize: 7, alignment: "center" } },
    content: contenido,
    footer: (pagina, total) => ({
      columns: [
        {
          text:
            `Cuadro ${numero} (${CUADRO[numero].codigo}) · modelo generado por el Sistema de almacenes INIAF ` +
            `el ${emitido.toLocaleDateString("es-BO")} a partir de los cierres de gestión`,
          fontSize: 6,
          color: "#777777",
        },
        {
          text: `Página ${pagina} de ${total}`,
          fontSize: 6,
          color: "#777777",
          alignment: "right",
          width: 70,
        },
      ],
      margin: [MARGEN, 6, MARGEN, 0],
    }),
  }
}

// --- Cuadro 5 -----------------------------------------------------------------

async function definicionCuadro5(
  datos: DatosCuadros
): Promise<TDocumentDefinitions> {
  const anchoUtil = 612 - MARGEN * 2
  const filas = agruparCuadro5(datos.filas)
  const total = filas.reduce(
    (t, f) => ({
      inicial: t.inicial + Math.round(f.valInicial * 100),
      final: t.final + Math.round(f.valFinal * 100),
    }),
    { inicial: 0, final: 0 }
  )
  const g = datos.gestion

  const tabla: Content = {
    table: {
      headerRows: 1,
      widths: [22, "*", 66, 76, 66, 76],
      body: [
        [
          { text: "Nº", style: "th" },
          { text: "Partida", style: "th" },
          { text: `Cantidad Inicial\nal 01/01/${g}`, style: "th" },
          { text: `Saldo Inicial\nal 01/01/${g}\n(Bs)`, style: "th" },
          { text: `Cantidad Final\nal 31/12/${g}`, style: "th" },
          { text: `Saldo Final\nal 31/12/${g}\n(Bs)`, style: "th" },
        ],
        ...filas.map((f, i): TableCell[] => [
          { text: String(i + 1), alignment: "center" },
          `${f.partidaCodigo} - ${f.partidaDenominacion}`,
          der(cantidad(f.cantInicial)),
          der(moneda(f.valInicial)),
          der(cantidad(f.cantFinal)),
          der(moneda(f.valFinal)),
        ]),
        [
          { text: "TOTAL", colSpan: 2, bold: true, alignment: "center" },
          {},
          der(""),
          der(moneda(total.inicial / 100), { bold: true }),
          der(""),
          der(moneda(total.final / 100), { bold: true }),
        ],
      ],
    },
    layout: { ...LAYOUT, fillColor: (i) => (i === 0 ? "#eeeeee" : null) },
    margin: [0, 8, 0, 0],
  }

  return documento(5, datos, false, [
    ...(await membrete(5, datos, anchoUtil)),
    filas.length === 0 ? sinDatos() : tabla,
    notas(),
  ])
}

// --- Cuadro 6 -----------------------------------------------------------------

async function definicionCuadro6(
  datos: DatosCuadros
): Promise<TDocumentDefinitions> {
  const anchoUtil = 792 - MARGEN * 2
  const t = totalesCuadro6(datos.filas)
  const vacio: TableCell = {}

  const tabla: Content = {
    table: {
      headerRows: 2,
      // 724 pt útiles: la descripción se queda con lo que sobra.
      widths: [20, "*", 46, 50, 40, 40, 40, 40, 58, 58, 58, 58],
      body: [
        [
          { text: "Nº", style: "th", rowSpan: 2 },
          { text: "Descripción (Ítem)", style: "th", rowSpan: 2 },
          { text: "Unidad de medida", style: "th", rowSpan: 2 },
          { text: "Precio Unitario", style: "th", rowSpan: 2 },
          { text: "Cantidad", style: "th", colSpan: 4 },
          vacio,
          vacio,
          vacio,
          { text: "Valores", style: "th", colSpan: 4 },
          vacio,
          vacio,
          vacio,
        ],
        [
          vacio,
          vacio,
          vacio,
          vacio,
          { text: "Saldo Inicial", style: "th" },
          { text: "Entradas", style: "th" },
          { text: "Salidas", style: "th" },
          { text: "Saldo Final", style: "th" },
          { text: "Saldo Inicial", style: "th" },
          { text: "Entradas", style: "th" },
          { text: "Salidas", style: "th" },
          { text: "Saldo Final", style: "th" },
        ],
        ...datos.filas.map((f, i): TableCell[] => [
          { text: String(i + 1), alignment: "center" },
          f.descripcion,
          { text: f.unidadMedida, alignment: "center" },
          der(precio(f.precio)),
          der(cantidad(f.cantInicial)),
          der(cantidad(f.cantEntradas)),
          der(cantidad(f.cantSalidas)),
          der(cantidad(f.cantFinal)),
          der(moneda(f.valInicial)),
          der(moneda(f.valEntradas)),
          der(moneda(f.valSalidas)),
          der(moneda(f.valFinal)),
        ]),
        [
          { text: "TOTAL", colSpan: 8, bold: true, alignment: "center" },
          vacio,
          vacio,
          vacio,
          vacio,
          vacio,
          vacio,
          vacio,
          der(moneda(t.inicial), { bold: true }),
          der(moneda(t.entradas), { bold: true }),
          der(moneda(t.salidas), { bold: true }),
          der(moneda(t.final), { bold: true }),
        ],
      ],
    },
    layout: { ...LAYOUT, fillColor: (i) => (i <= 1 ? "#eeeeee" : null) },
    margin: [0, 8, 0, 0],
  }

  return documento(6, datos, true, [
    ...(await membrete(6, datos, anchoUtil)),
    datos.filas.length === 0 ? sinDatos() : tabla,
    notas(),
  ])
}

function sinDatos(): Content {
  return {
    text: "Sin existencias ni movimientos en la gestión.",
    italics: true,
    margin: [0, 10, 0, 0],
  }
}

export async function crearCuadroPdf(
  numero: NumeroCuadro,
  datos: DatosCuadros
) {
  const pdfMake = await cargarPdfMake()
  const definicion =
    numero === 5
      ? await definicionCuadro5(datos)
      : await definicionCuadro6(datos)
  return pdfMake.createPdf(definicion)
}

export function nombreArchivoCuadroPdf(
  numero: NumeroCuadro,
  datos: DatosCuadros
): string {
  return `${nombreBase(numero, datos)}.pdf`
}
