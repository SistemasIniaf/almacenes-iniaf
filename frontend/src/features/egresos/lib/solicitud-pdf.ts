import { etiquetaNumero, ESTADO_LABEL } from "@/features/egresos/egresos.types"
import { cargarPdfMake, logosMembrete, MARGEN_PDF } from "@/lib/pdf"

import type { Egreso } from "@/features/egresos/egresos.types"
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

/**
 * «Solicitud de materiales y/o suministros de almacén», como PDF de verdad.
 *
 * Hermana de la nota de ingreso: mismo membrete, misma hoja, mismos estilos y
 * la misma base de `lib/pdf` (carga de pdfmake, fuente Helvetica y logos). Si
 * cada documento armara su encabezado, en dos cambios dejan de verse iguales.
 *
 * Medidas en PUNTOS (1 pulgada = 72 pt), hoja Carta APAISADA (792 x 612) con
 * márgenes de 12 mm: el ancho útil es 724 pt, y a eso tienen que sumar los
 * anchos de la tabla.
 */

const MARGEN = MARGEN_PDF
const ANCHO_UTIL = 792 - MARGEN * 2

/** Tal cual lo titula el reporte del sistema anterior. */
const TITULO_DOCUMENTO = "SOLICITUD DE MATERIALES Y/O SUMINISTROS DE ALMACEN"

const numero = (n: number) =>
  n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—"

const campo = (rotulo: string, valor: string) => ({
  stack: [
    { text: rotulo.toUpperCase(), style: "rotulo" },
    { text: valor || "—", style: "valor" },
  ],
  margin: [0, 0, 8, 0] as [number, number, number, number],
})

/** Fila de datos sobre la misma grilla de 12 que usa la nota de ingreso. */
const fila = (
  campos: [ancho: number, rotulo: string, valor: string][]
): Content => ({
  columns: campos.map(([ancho, rotulo, valor]) => ({
    width: (ancho * ANCHO_UTIL) / 12,
    ...campo(rotulo, valor),
  })),
})

/**
 * Pie de firmas. Se imprimen los nombres de quienes YA actuaron (salen del
 * pedido y de su historial) y queda el recuadro para firmar a mano, como en el
 * documento anterior.
 *
 * El recuadro «Programa» del reporte viejo NO va: la categoría se eliminó el
 * 2026-07-29 y su lugar lo ocupa la justificación.
 */
function firmas(egreso: Egreso): Content {
  const aprobacion = egreso.historial.find(
    (h) => h.estadoNuevo === "PENDIENTE_RESPONSABLE_ALMACEN"
  )

  const casillas: [string, string][] = [
    ["Solicitante", egreso.solicitante.nombre],
    ["Jefe de Unidad", aprobacion?.usuario.nombre ?? ""],
    ["Encargado de Almacenes", egreso.entregadoPor?.nombre ?? ""],
    ["Recibí conforme", egreso.solicitante.nombre],
  ]

  return {
    columns: casillas.map(([rotulo, nombre]) => ({
      width: ANCHO_UTIL / casillas.length,
      stack: [
        // El espacio en blanco es para la firma manuscrita.
        { text: " ", margin: [0, 18, 0, 0] as [number, number, number, number] },
        {
          canvas: [
            {
              type: "line" as const,
              x1: 10,
              y1: 0,
              x2: ANCHO_UTIL / casillas.length - 20,
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#000000",
            },
          ],
        },
        {
          text: nombre || " ",
          fontSize: 7.5,
          alignment: "center" as const,
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        {
          text: rotulo,
          fontSize: 7,
          bold: true,
          alignment: "center" as const,
        },
      ],
    })),
    margin: [0, 24, 0, 0],
  }
}

export async function definicionSolicitud(
  egreso: Egreso
): Promise<TDocumentDefinitions> {
  const { iniaf: logoIniaf, ministerio: logoMinisterio } =
    await logosMembrete()

  const etiqueta = etiquetaNumero(egreso)
  const anulado = egreso.estado === "ANULADO"

  const encabezado: Content = {
    columns: [
      { image: logoIniaf, width: 99, alignment: "left" },
      {
        width: "*",
        stack: [
          { text: TITULO_DOCUMENTO, style: "titulo" },
          { text: egreso.almacen.nombre.toUpperCase(), style: "subtitulo" },
          {
            text: `Nº ${etiqueta}`,
            fontSize: 13,
            bold: true,
            margin: [0, 3, 0, 0],
          },
          {
            // La fecha de ENVÍO: es cuando el pedido se volvió documento y de
            // ella sale la gestión de su número. Un borrador todavía no la tiene.
            text: `Fecha: ${fecha(egreso.fechaEnvio ?? egreso.createdAt)}`,
            fontSize: 8.5,
            margin: [0, 2, 0, 0],
          },
          ...(anulado
            ? [
                {
                  text: "ANULADO",
                  bold: true,
                  fontSize: 9,
                  characterSpacing: 1.5,
                  margin: [0, 2, 0, 0] as [number, number, number, number],
                },
              ]
            : []),
        ],
        alignment: "center",
      },
      { image: logoMinisterio, width: 72, alignment: "right" },
    ],
    columnGap: 8,
  }

  const datos: Content = {
    table: {
      widths: ["*"],
      body: [
        [
          fila([
            [4, "Unidad solicitante", egreso.unidad.nombre],
            [4, "Solicitante", egreso.solicitante.nombre],
            [2, "Fecha de entrega", fecha(egreso.fechaEntrega)],
            [2, "Estado", ESTADO_LABEL[egreso.estado]],
          ]),
        ],
        // La justificación ocupa la fila entera: reemplaza a la "actividad" del
        // sistema anterior y suele ser una oración, no un dato corto.
        [fila([[12, "Justificación", egreso.justificacion]])],
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => "#bbbbbb",
      paddingTop: () => 4,
      paddingBottom: () => 2,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: [0, 10, 0, 0],
  }

  // Mismas columnas que el reporte del sistema anterior. El ancho flexible se lo
  // lleva la descripción; el resto es fijo y suma con ella los 724 pt útiles.
  const cabecera: TableCell[] = [
    { text: "Nº", style: "th", alignment: "center" },
    { text: "Código", style: "th" },
    { text: "Descripción", style: "th" },
    { text: "Fuente", style: "th" },
    { text: "Partida", style: "th", alignment: "center" },
    { text: "Unidad", style: "th", alignment: "center" },
    { text: "Cant. solicitada", style: "th", alignment: "right" },
    { text: "Cant. despachada", style: "th", alignment: "right" },
  ]

  const filas: TableCell[][] = egreso.detalles.map((detalle, indice) => {
    const lote = detalle.ingresoDetalle
    const descripcion = detalle.observacion
      ? `${lote.item.descripcion} (${detalle.observacion})`
      : lote.item.descripcion
    return [
      { text: String(indice + 1), alignment: "center", fontSize: 7.5 },
      { text: lote.item.codigo, fontSize: 7.5 },
      { text: descripcion, fontSize: 7.5 },
      {
        text: lote.ingreso.fuenteFinanciamiento?.nombre ?? "—",
        fontSize: 7.5,
      },
      { text: lote.item.partida.codigo, alignment: "center", fontSize: 7.5 },
      { text: lote.item.unidadMedida, alignment: "center", fontSize: 7.5 },
      {
        text: numero(Number(detalle.cantidadSolicitada)),
        alignment: "right",
        fontSize: 7.5,
      },
      {
        // Vacío mientras no se entregó: el documento se puede imprimir antes.
        text:
          detalle.cantidadEntregada == null
            ? ""
            : numero(Number(detalle.cantidadEntregada)),
        alignment: "right",
        fontSize: 7.5,
      },
    ]
  })

  const detalle: Content = {
    table: {
      headerRows: 1,
      // 22 + 62 + * + 96 + 44 + 44 + 68 + 72 = 724 con la descripción flexible.
      widths: [22, 62, "*", 96, 44, 44, 68, 72],
      body: [cabecera, ...filas],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      paddingTop: () => 3,
      paddingBottom: () => 3,
      paddingLeft: () => 4,
      paddingRight: () => 4,
    },
    margin: [0, 12, 0, 0],
  }

  const pieAnulacion: Content[] = anulado
    ? [
        {
          text:
            `Anulado por ${egreso.anuladoPor?.nombre ?? "—"}` +
            `${egreso.anuladoEn ? ` el ${fecha(egreso.anuladoEn)}` : ""}` +
            `${egreso.motivoAnulacion ? `. Motivo: ${egreso.motivoAnulacion}` : ""}`,
          fontSize: 7.5,
          margin: [0, 10, 0, 0],
        },
      ]
    : []

  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    info: {
      title: `Solicitud de materiales ${etiqueta.replace("/", "-")}`,
      subject: `Egreso de almacén ${etiqueta} — ${egreso.almacen.nombre}`,
      creator: "Sistema de almacenes INIAF",
    },
    watermark: anulado
      ? {
          text: "ANULADO",
          color: "#999999",
          opacity: 0.25,
          bold: true,
          angle: -30,
        }
      : undefined,
    defaultStyle: { font: "Helvetica", fontSize: 8.5 },
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
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: ANCHO_UTIL,
            y2: 0,
            lineWidth: 1,
            lineColor: "#000000",
          },
        ],
        margin: [0, 6, 0, 0],
      },
      datos,
      detalle,
      firmas(egreso),
      ...pieAnulacion,
    ],
    footer: (pagina, total) => ({
      text: `Página ${pagina} de ${total}`,
      alignment: "right",
      fontSize: 7,
      color: "#666666",
      margin: [MARGEN, 0, MARGEN, 0],
    }),
  }
}

/** Arma el PDF (la carga de pdfmake y la fuente van en `lib/pdf`). */
export async function crearSolicitudPdf(egreso: Egreso) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(await definicionSolicitud(egreso))
}

/** Nombre del archivo al descargar: `solicitud-001-2026.pdf`. */
export function nombreArchivo(egreso: Egreso): string {
  return `solicitud-${etiquetaNumero(egreso).replace("/", "-")}.pdf`
}
