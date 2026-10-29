import {
  descripcionLote,
  documentoLote,
  etiquetaNumero,
} from "@/features/traspasos/traspasos.types"
import { cantidad, moneda, precio } from "@/lib/formato"
import { montoALiteral } from "@/lib/numero-literal"
import {
  cargarPdfMake,
  columnaLogo,
  logosMembrete,
  MARGEN_PDF,
} from "@/lib/pdf"

import type { Traspaso } from "@/features/traspasos/traspasos.types"
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

/**
 * Nota de traspaso entre almacenes. Hermana de la nota de ingreso
 * (`features/ingresos/lib/nota-ingreso-pdf.ts`): mismo membrete, misma hoja
 * Carta apaisada (724 pt útiles) y mismos estilos, para que se archiven juntas.
 *
 * El pie lleva tres firmas: quien ENTREGA (el almacén de origen), quien RECIBE
 * (el de destino) y el VoBo administrativo. Son rótulos fijos.
 */

const MARGEN = MARGEN_PDF
const ANCHO_UTIL = 792 - MARGEN * 2

const TITULO_DOCUMENTO = "NOTA DE TRASPASO ENTRE ALMACENES"

const FIRMAS = [
  "Entregué conforme\n(Almacén de origen)",
  "Recibí conforme\n(Almacén de destino)",
  "VoBo Jefe Administrativo",
]

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

const fechaHora = (iso: string) =>
  `${fecha(iso)} ${new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

const campo = (rotulo: string, valor: string, ancho: number) => ({
  width: ancho,
  stack: [
    { text: rotulo.toUpperCase(), style: "rotulo" },
    { text: valor || "—", style: "valor" },
  ],
  margin: [0, 0, 8, 0] as [number, number, number, number],
})

export async function crearNotaTraspasoPdf(traspaso: Traspaso) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionNotaTraspaso(traspaso))
}

/** `nota-traspaso-001-2026.pdf`. */
export function nombreArchivo(traspaso: Traspaso): string {
  return `nota-traspaso-${etiquetaNumero(traspaso)}.pdf`
}

export async function definicionNotaTraspaso(
  traspaso: Traspaso
): Promise<TDocumentDefinitions> {
  const { iniaf: logoIniaf, ministerio: logoMinisterio } = await logosMembrete()
  const numero = etiquetaNumero(traspaso)

  const lineas = traspaso.detalles.map((d) => {
    const cant = Number(d.cantidad)
    const unitario = Number(d.loteOrigen.precioUnitario)
    return { lote: d.loteOrigen, cant, unitario, subtotal: cant * unitario }
  })
  const total = lineas.reduce((suma, l) => suma + l.subtotal, 0)

  const encabezado: Content = {
    columns: [
      columnaLogo(logoIniaf, [99, 43], "left"),
      {
        width: "*",
        stack: [
          { text: TITULO_DOCUMENTO, style: "titulo" },
          {
            text: traspaso.almacenOrigen.nombre.toUpperCase(),
            style: "subtitulo",
          },
          {
            text: `Nº ${numero}`,
            fontSize: 13,
            bold: true,
            margin: [0, 3, 0, 0],
          },
          {
            text: `Fecha: ${fecha(traspaso.fecha)}`,
            fontSize: 8.5,
            margin: [0, 2, 0, 0],
          },
        ],
        alignment: "center",
      },
      columnaLogo(logoMinisterio, [72, 57], "right"),
    ],
    columnGap: 8,
  }

  const datos: Content = {
    columns: [
      campo("Almacén de origen", traspaso.almacenOrigen.nombre, ANCHO_UTIL / 3),
      campo(
        "Almacén de destino",
        traspaso.almacenDestino.nombre,
        ANCHO_UTIL / 3
      ),
      campo("Registrado por", traspaso.registradoPor.nombre, ANCHO_UTIL / 3),
    ],
    margin: [0, 10, 0, 0],
  }

  const cabeceraDetalle: TableCell[] = [
    { text: "Nº", style: "th", alignment: "center" },
    { text: "Código", style: "th" },
    { text: "Descripción", style: "th" },
    { text: "Fuente", style: "th" },
    { text: "Documento de origen", style: "th" },
    { text: "Unidad", style: "th", alignment: "center" },
    { text: "Cantidad", style: "th", alignment: "right" },
    { text: "P. unitario", style: "th", alignment: "right" },
    { text: "Total", style: "th", alignment: "right" },
  ]

  const detalle: Content = {
    table: {
      headerRows: 1,
      // Suman los 724 pt útiles con la descripción como columna flexible.
      widths: [20, 72, "*", 100, 90, 50, 52, 60, 64],
      body: [
        cabeceraDetalle,
        ...lineas.map((l, indice): TableCell[] => [
          { text: String(indice + 1), alignment: "center" },
          { text: l.lote.item.codigo, noWrap: true },
          { text: descripcionLote(l.lote) },
          { text: l.lote.ingreso.fuenteFinanciamiento?.nombre ?? "—" },
          { text: documentoLote(l.lote.ingreso) },
          { text: l.lote.item.unidadMedida, alignment: "center" },
          { text: cantidad(l.cant), alignment: "right" },
          { text: precio(l.unitario), alignment: "right" },
          { text: moneda(l.subtotal), alignment: "right" },
        ]),
        [
          { text: "TOTAL Bs", colSpan: 8, alignment: "right", bold: true },
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          { text: moneda(total), alignment: "right", bold: true },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#888888",
      vLineColor: () => "#888888",
      fillColor: (fila) => (fila === 0 ? "#eeeeee" : null),
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 10, 0, 0],
  }

  const literal: Content = {
    table: {
      widths: ["*"],
      body: [[{ text: montoALiteral(total), bold: true }]],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#888888",
      vLineColor: () => "#888888",
    },
    margin: [0, 6, 0, 0],
  }

  const motivoYFirmas: Content = {
    table: {
      widths: ["*"],
      body: [
        [{ text: "MOTIVO DEL TRASPASO:", bold: true, fontSize: 7 }],
        [{ text: traspaso.observacion }],
        [
          {
            columns: FIRMAS.map((firma) => ({
              text: firma,
              alignment: "center" as const,
              bold: true,
            })),
            margin: [0, 75, 0, 2],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
    },
    unbreakable: true,
    margin: [0, 8, 0, 0],
  }

  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    info: {
      title: `Nota de traspaso ${numero}`,
      subject: `Traspaso ${numero} — ${traspaso.almacenOrigen.nombre} a ${traspaso.almacenDestino.nombre}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 8, lineHeight: 1.1 },
    styles: {
      titulo: { fontSize: 11, bold: true },
      subtitulo: { fontSize: 9.5, bold: true, margin: [0, 1, 0, 0] },
      rotulo: { fontSize: 6, color: "#666666" },
      valor: { fontSize: 8.5, margin: [0, 1, 0, 0] },
      th: { bold: true, fontSize: 7.5 },
    },
    content: [
      encabezado,
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: ANCHO_UTIL, y2: 0, lineWidth: 1.5 },
        ],
        margin: [0, 6, 0, 0],
      },
      datos,
      detalle,
      literal,
      motivoYFirmas,
    ],
    footer: (paginaActual, totalPaginas) => ({
      columns: [
        {
          text:
            `Registrado por ${traspaso.registradoPor.nombre} el ${fechaHora(traspaso.createdAt)}` +
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
