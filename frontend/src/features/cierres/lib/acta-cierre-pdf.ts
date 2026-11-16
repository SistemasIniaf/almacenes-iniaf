import { cantidad, moneda, precio } from "@/lib/formato"
import {
  cargarPdfMake,
  columnaLogo,
  logosMembrete,
  MARGEN_PDF,
} from "@/lib/pdf"

import type { Cierre, CierreSaldo } from "@/features/cierres/cierres.types"
import type {
  Column,
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

/**
 * Acta de cierre de gestión de UN almacén (2026-11-16). Hermana de la nota de
 * ingreso y la de traspaso: mismo membrete, hoja Carta apaisada (724 pt útiles).
 *
 * Sale SIEMPRE de lo guardado en el cierre (la foto), no del stock del día: así
 * se reimprime igual años después.
 *
 * Tres partes:
 * 1. el texto del acta, con el resumen valorado y los documentos de la gestión;
 * 2. el resumen por PARTIDA (lo que después alimenta el Cuadro 5);
 * 3. el detalle por lote —ítem + fuente + precio— con lo que tenía al 01/01,
 *    entró, salió y quedó al 31/12.
 *
 * Las FIRMAS quedan pendientes (decisión del usuario, 2026-11-16): la
 * institución todavía no definió quién firma el acta.
 */

const MARGEN = MARGEN_PDF
const ANCHO_UTIL = 792 - MARGEN * 2

const BORDE_FINO: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#888888",
  vLineColor: () => "#888888",
  paddingTop: () => 2.5,
  paddingBottom: () => 2.5,
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  })

const valor = (c: string, p: string) => Number(c) * Number(p)

/** Lo de traspasos se valoriza acá: el backend guarda solo la cantidad. */
function valorTraspasos(saldos: CierreSaldo[]) {
  let recibidos = 0
  let enviados = 0
  for (const s of saldos) {
    recibidos += valor(s.cantidadEntradasTraspaso, s.precioUnitario)
    enviados += valor(s.cantidadSalidasTraspaso, s.precioUnitario)
  }
  return { recibidos, enviados }
}

interface GrupoPartida {
  codigo: string
  denominacion: string
  filas: CierreSaldo[]
  inicial: number
  entradas: number
  salidas: number
  final: number
}

/** Los saldos llegan ordenados por código de partida: se agrupan en orden. */
function agruparPorPartida(saldos: CierreSaldo[]): GrupoPartida[] {
  const grupos = new Map<number, GrupoPartida>()
  for (const s of saldos) {
    let g = grupos.get(s.partida.id)
    if (!g) {
      g = {
        codigo: s.partida.codigo,
        denominacion: s.partida.denominacion,
        filas: [],
        inicial: 0,
        entradas: 0,
        salidas: 0,
        final: 0,
      }
      grupos.set(s.partida.id, g)
    }
    g.filas.push(s)
    g.inicial += valor(s.cantidadInicial, s.precioUnitario)
    g.entradas += valor(s.cantidadEntradas, s.precioUnitario)
    g.salidas += valor(s.cantidadSalidas, s.precioUnitario)
    g.final += valor(s.cantidadFinal, s.precioUnitario)
  }
  return [...grupos.values()]
}

export async function crearActaCierrePdf(cierre: Cierre) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionActaCierre(cierre))
}

/** `acta-cierre-2026-almacen-central.pdf`. */
export function nombreArchivoActa(cierre: Cierre): string {
  const almacen = cierre.almacen.nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `acta-cierre-${cierre.gestion}-${almacen}.pdf`
}

export async function definicionActaCierre(
  cierre: Cierre
): Promise<TDocumentDefinitions> {
  const { iniaf: logoIniaf, ministerio: logoMinisterio } = await logosMembrete()
  const g = cierre.gestion
  const traspasos = valorTraspasos(cierre.saldos)
  const grupos = agruparPorPartida(cierre.saldos)
  const d = cierre.documentos

  const encabezado: Content = {
    columns: [
      columnaLogo(logoIniaf, [99, 43], "left"),
      {
        width: "*",
        stack: [
          { text: `ACTA DE CIERRE DE GESTIÓN ${g}`, style: "titulo" },
          { text: cierre.almacen.nombre.toUpperCase(), style: "subtitulo" },
          {
            text: `Saldos al 31/12/${g}`,
            fontSize: 8.5,
            margin: [0, 3, 0, 0],
          },
        ],
        alignment: "center",
      },
      columnaLogo(logoMinisterio, [72, 57], "right"),
    ],
    columnGap: 8,
  }

  const aviso: Content[] = cierre.anticipado
    ? [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text:
                    `CIERRE ANTICIPADO: se realizó el ${fecha(cierre.cerradoEn)}, antes de terminar la gestión. ` +
                    `Los saldos son los registrados hasta ese momento, y el almacén quedó sin poder registrar ` +
                    `movimientos hasta el 01/01/${g + 1}.`,
                  bold: true,
                  fontSize: 7.5,
                },
              ],
            ],
          },
          layout: {
            ...BORDE_FINO,
            fillColor: () => "#fff4dd",
          },
          margin: [0, 8, 0, 0],
        },
      ]
    : []

  const texto: Content = {
    text: [
      "En fecha ",
      { text: fecha(cierre.cerradoEn), bold: true },
      ` a horas ${hora(cierre.cerradoEn)}, `,
      { text: cierre.cerradoPor.nombre, bold: true },
      " registró en el Sistema de Almacenes el cierre de la gestión ",
      { text: String(g), bold: true },
      " del almacén ",
      { text: cierre.almacen.nombre, bold: true },
      ". Los saldos que se detallan corresponden a los registros del sistema " +
        `(kardex por lote) al 31 de diciembre de ${g}, sin recuento físico, y ` +
        `constituyen el saldo inicial de la gestión ${g + 1}. A partir de este ` +
        `cierre no se puede registrar, modificar ni anular ningún documento de la gestión ${g}.`,
    ],
    alignment: "justify",
    fontSize: 8.5,
    lineHeight: 1.3,
    margin: [0, 10, 0, 0],
  }

  const fila = (
    rotulo: string,
    monto: number | string,
    negrita = false
  ): TableCell[] => [
    { text: rotulo, bold: negrita },
    { text: moneda(monto), alignment: "right" as const, bold: negrita },
  ]
  const nota = (texto: string, monto: number): TableCell[] => [
    {
      text: texto,
      fontSize: 7,
      color: "#555555",
      margin: [10, 0, 0, 0] as [number, number, number, number],
    },
    {
      text: moneda(monto),
      fontSize: 7,
      color: "#555555",
      alignment: "right" as const,
    },
  ]

  const resumen: Column = {
    width: "*",
    stack: [
      { text: "RESUMEN VALORADO (Bs)", style: "seccion" },
      {
        table: {
          widths: ["*", 90],
          body: [
            fila(`Saldo inicial al 01/01/${g}`, cierre.valorInicial),
            fila("(+) Entradas de la gestión", cierre.valorEntradas),
            ...(traspasos.recibidos
              ? [nota("de ellas, por traspaso recibido", traspasos.recibidos)]
              : []),
            fila("(-) Salidas de la gestión", cierre.valorSalidas),
            ...(traspasos.enviados
              ? [nota("de ellas, por traspaso enviado", traspasos.enviados)]
              : []),
            fila(`Saldo final al 31/12/${g}`, cierre.valorFinal, true),
          ],
        },
        layout: BORDE_FINO,
      },
    ],
  }

  const documentos: Column = {
    width: 300,
    stack: [
      { text: `DOCUMENTOS DE LA GESTIÓN ${g}`, style: "seccion" },
      {
        table: {
          widths: ["*", 50, 50],
          body: [
            [
              { text: "Documento", style: "th" },
              { text: "Válidos", style: "th", alignment: "right" },
              { text: "Anulados", style: "th", alignment: "right" },
            ],
            [
              "Notas de ingreso",
              { text: String(d.ingresosConfirmados), alignment: "right" },
              { text: String(d.ingresosAnulados), alignment: "right" },
            ],
            [
              "Pedidos entregados",
              { text: String(d.egresosEntregados), alignment: "right" },
              { text: String(d.egresosAnulados), alignment: "right" },
            ],
            [
              "Pedidos desistidos",
              { text: String(d.egresosDesistidos), alignment: "right" },
              { text: "—", alignment: "right" },
            ],
            [
              "Traspasos enviados",
              { text: String(d.traspasosEnviados), alignment: "right" },
              { text: "—", alignment: "right" },
            ],
            [
              "Traspasos recibidos",
              { text: String(d.traspasosRecibidos), alignment: "right" },
              { text: "—", alignment: "right" },
            ],
          ],
        },
        layout: {
          ...BORDE_FINO,
          fillColor: (i) => (i === 0 ? "#eeeeee" : null),
        },
      },
    ],
  }

  const cuadros: Content = {
    columns: [resumen, documentos],
    columnGap: 16,
    margin: [0, 10, 0, 0],
  }

  // --- Resumen por partida ---------------------------------------------------
  const porPartida: Content = {
    stack: [
      { text: "RESUMEN POR PARTIDA (Bs)", style: "seccion" },
      {
        table: {
          headerRows: 1,
          widths: [50, "*", 80, 80, 80, 80],
          body: [
            [
              { text: "Partida", style: "th" },
              { text: "Denominación", style: "th" },
              { text: `Saldo al 01/01`, style: "th", alignment: "right" },
              { text: "Entradas", style: "th", alignment: "right" },
              { text: "Salidas", style: "th", alignment: "right" },
              { text: `Saldo al 31/12`, style: "th", alignment: "right" },
            ],
            ...grupos.map((p): TableCell[] => [
              p.codigo,
              p.denominacion,
              { text: moneda(p.inicial), alignment: "right" },
              { text: moneda(p.entradas), alignment: "right" },
              { text: moneda(p.salidas), alignment: "right" },
              { text: moneda(p.final), alignment: "right" },
            ]),
            [
              { text: "TOTAL", colSpan: 2, bold: true, alignment: "right" },
              {},
              {
                text: moneda(cierre.valorInicial),
                bold: true,
                alignment: "right",
              },
              {
                text: moneda(cierre.valorEntradas),
                bold: true,
                alignment: "right",
              },
              {
                text: moneda(cierre.valorSalidas),
                bold: true,
                alignment: "right",
              },
              {
                text: moneda(cierre.valorFinal),
                bold: true,
                alignment: "right",
              },
            ],
          ],
        },
        layout: {
          ...BORDE_FINO,
          fillColor: (i) => (i === 0 ? "#eeeeee" : null),
        },
      },
    ],
    margin: [0, 12, 0, 0],
  }

  // --- Detalle por lote -------------------------------------------------------
  const cuerpoDetalle: TableCell[][] = [
    [
      { text: "Código", style: "th" },
      { text: "Descripción", style: "th" },
      { text: "Unidad", style: "th", alignment: "center" },
      { text: "Fuente", style: "th" },
      { text: "P. unitario", style: "th", alignment: "right" },
      { text: "Saldo 01/01", style: "th", alignment: "right" },
      { text: "Entradas", style: "th", alignment: "right" },
      { text: "Salidas", style: "th", alignment: "right" },
      { text: "Saldo 31/12", style: "th", alignment: "right" },
      { text: "Valor 31/12 (Bs)", style: "th", alignment: "right" },
    ],
  ]
  const COLUMNAS = 10
  const vacias = (n: number): TableCell[] =>
    Array.from({ length: n }, () => ({}))
  for (const p of grupos) {
    cuerpoDetalle.push([
      {
        text: `${p.codigo} · ${p.denominacion}`,
        colSpan: COLUMNAS,
        bold: true,
        fillColor: "#f4f4f4",
      },
      ...vacias(COLUMNAS - 1),
    ])
    for (const s of p.filas) {
      cuerpoDetalle.push([
        { text: s.item.codigo, noWrap: true },
        s.item.descripcion,
        { text: s.item.unidadMedida, alignment: "center" },
        s.fuenteFinanciamiento?.nombre ?? "—",
        { text: precio(s.precioUnitario), alignment: "right" },
        { text: cantidad(s.cantidadInicial), alignment: "right" },
        { text: cantidad(s.cantidadEntradas), alignment: "right" },
        { text: cantidad(s.cantidadSalidas), alignment: "right" },
        { text: cantidad(s.cantidadFinal), alignment: "right", bold: true },
        {
          text: moneda(valor(s.cantidadFinal, s.precioUnitario)),
          alignment: "right",
        },
      ])
    }
    cuerpoDetalle.push([
      {
        text: `Subtotal partida ${p.codigo}`,
        colSpan: COLUMNAS - 1,
        alignment: "right",
        bold: true,
      },
      ...vacias(COLUMNAS - 2),
      { text: moneda(p.final), alignment: "right", bold: true },
    ])
  }
  cuerpoDetalle.push([
    {
      text: `SALDO FINAL AL 31/12/${g}`,
      colSpan: COLUMNAS - 1,
      alignment: "right",
      bold: true,
    },
    ...vacias(COLUMNAS - 2),
    { text: moneda(cierre.valorFinal), alignment: "right", bold: true },
  ])

  const detalle: Content =
    cierre.saldos.length === 0
      ? {
          text: "El almacén no tuvo existencias ni movimientos en la gestión.",
          italics: true,
          margin: [0, 12, 0, 0],
        }
      : {
          stack: [
            {
              text: "DETALLE DE EXISTENCIAS POR ÍTEM, FUENTE Y PRECIO",
              style: "seccion",
            },
            {
              table: {
                headerRows: 1,
                // Suman los 724 pt útiles con la descripción flexible.
                widths: [62, "*", 44, 92, 52, 46, 46, 46, 50, 64],
                body: cuerpoDetalle,
              },
              layout: {
                ...BORDE_FINO,
                fillColor: (i) => (i === 0 ? "#eeeeee" : null),
              },
            },
          ],
          margin: [0, 12, 0, 0],
          pageBreak: "before",
        }

  const observaciones: Content = {
    table: {
      widths: ["*"],
      body: [
        [{ text: "OBSERVACIONES:", bold: true, fontSize: 7 }],
        [{ text: " ", margin: [0, 24, 0, 0] }],
      ],
    },
    layout: BORDE_FINO,
    unbreakable: true,
    margin: [0, 12, 0, 0],
  }

  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    info: {
      title: `Acta de cierre de gestión ${g} — ${cierre.almacen.nombre}`,
      subject: `Cierre de gestión ${g}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7.5, lineHeight: 1.1 },
    styles: {
      titulo: { fontSize: 12, bold: true },
      subtitulo: { fontSize: 9.5, bold: true, margin: [0, 2, 0, 0] },
      seccion: { fontSize: 8, bold: true, margin: [0, 0, 0, 4] },
      th: { bold: true, fontSize: 7 },
    },
    content: [
      encabezado,
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: ANCHO_UTIL, y2: 0, lineWidth: 1.5 },
        ],
        margin: [0, 6, 0, 0],
      },
      ...aviso,
      texto,
      cuadros,
      porPartida,
      observaciones,
      detalle,
    ],
    footer: (paginaActual, totalPaginas) => ({
      columns: [
        {
          text:
            `Acta de cierre de gestión ${g} · ${cierre.almacen.nombre} · ` +
            `cerrada por ${cierre.cerradoPor.nombre} el ${fecha(cierre.cerradoEn)} ${hora(cierre.cerradoEn)}` +
            ` · Sistema de almacenes INIAF`,
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
      margin: [MARGEN, 6, MARGEN, 0],
    }),
  }
}
