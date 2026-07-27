import { etiquetaNumero } from "@/features/ingresos/ingresos.types"
import { montoALiteral } from "@/lib/numero-literal"

import type { Ingreso } from "@/features/ingresos/ingresos.types"
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

/**
 * Nota de ingreso a almacén, como PDF de verdad.
 *
 * Se genera en el NAVEGADOR con pdfmake y se abre en el visor del navegador
 * (miniaturas, zoom, descargar, imprimir), igual que el sistema anterior — que
 * lo armaba en el servidor con PHP. Hacerlo acá evita meterle un Chrome headless
 * al backend on-premise, y el PDF sale vectorial: texto seleccionable y nítido a
 * cualquier zoom, no una captura de pantalla.
 *
 * Las medidas van en PUNTOS, que es la unidad de un PDF: 1 pulgada = 72 pt.
 * La hoja es Carta APAISADA (11 x 8,5 in = 792 x 612 pt) con márgenes de 12 mm
 * (34 pt), así que el ancho útil es 724 pt — el número al que tienen que sumar
 * los anchos de las tablas.
 */

const MARGEN = 34
/** Carta apaisada: el lado largo (11 in = 792 pt) es el horizontal. */
const ANCHO_UTIL = 792 - MARGEN * 2

/** Tal cual lo titula la institución (así figura en el reporte anterior). */
const TITULO_DOCUMENTO = "INGRESO ALMACEN MATERIAL Y/O SUMINISTROS"

const LOGOS = {
  iniaf: "/iniaf/logo-iniaf.png",
  ministerio: "/iniaf/logo-ministerio.png",
} as const

/** pdfmake necesita las imágenes embebidas; se leen una vez y quedan cacheadas. */
const cacheLogos = new Map<string, string>()

async function comoDataUrl(ruta: string): Promise<string> {
  const cacheado = cacheLogos.get(ruta)
  if (cacheado) return cacheado

  const respuesta = await fetch(ruta)
  if (!respuesta.ok) throw new Error(`No se pudo leer el logo ${ruta}`)
  const blob = await respuesta.blob()
  const dataUrl = await new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(lector.result as string)
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(blob)
  })

  cacheLogos.set(ruta, dataUrl)
  return dataUrl
}

const moneda = (n: number) =>
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

const fechaHora = (iso: string) =>
  `${fecha(iso)} ${new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

/**
 * Rótulo chico arriba y valor abajo, como los campos del formulario.
 * Sin anotar como `TableCell` a propósito: ese tipo es una unión y al
 * desparramarlo para agregarle `colSpan` se pierde la forma concreta.
 */
const campo = (rotulo: string, valor: string) => ({
  stack: [
    { text: rotulo.toUpperCase(), style: "rotulo" },
    { text: valor || "—", style: "valor" },
  ],
})

/**
 * Una fila de datos, con los MISMOS anchos que el formulario.
 *
 * La tabla tiene 12 columnas iguales y cada campo declara cuántas ocupa, así el
 * documento se puede reordenar copiando los `col-span` de `IngresoFormPage` sin
 * recalcular anchos. pdfmake exige rellenar con celdas vacías las columnas que
 * absorbe un `colSpan`.
 */
const fila = (campos: [ancho: number, rotulo: string, valor: string][]) => {
  const celdas: TableCell[] = []
  for (const [ancho, rotulo, valor] of campos) {
    celdas.push({ ...campo(rotulo, valor), colSpan: ancho })
    for (let i = 1; i < ancho; i++) celdas.push({})
  }
  return celdas
}

/** Rótulos del pie de firmas: son cargos fijos, no salen de la base. */
const FIRMAS = [
  "Encargado Almacén",
  "Unidad Solicitante",
  "VoBo Jefe Administrativo",
]

/**
 * Arma el PDF. pdfmake se carga con `import()` dinámico para que no pese en el
 * bundle de quien nunca imprime, y se usa **Helvetica** (una de las 14 fuentes
 * que todo lector de PDF ya tiene) en vez del Roboto que trae pdfmake: son
 * 300 KB en lugar de 854 KB, la fuente no se embebe en el archivo y es el tipo
 * que usan estos documentos.
 */
export async function crearNotaIngresoPdf(ingreso: Ingreso) {
  const [modulo, helvetica] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/standard-fonts/Helvetica"),
  ])

  // pdfmake es CommonJS (`module.exports = new pdfmake()`), así que la instancia
  // llega en `default`. Los nombres sueltos NO sirven: sus métodos vienen del
  // prototipo de la clase y el interop del bundler no los expone (se cae con
  // "addFontContainer is not a function").
  const pdfMake = modulo.default ?? modulo

  pdfMake.addFontContainer(helvetica.default ?? helvetica)
  return pdfMake.createPdf(await definicionNotaIngreso(ingreso))
}

/** Nombre del archivo al descargar: `nota-ingreso-001-2026.pdf`. */
export function nombreArchivo(ingreso: Ingreso): string {
  return `nota-ingreso-${etiquetaNumero(ingreso).replace("/", "-")}.pdf`
}

export async function definicionNotaIngreso(
  ingreso: Ingreso
): Promise<TDocumentDefinitions> {
  const [logoIniaf, logoMinisterio] = await Promise.all([
    comoDataUrl(LOGOS.iniaf),
    comoDataUrl(LOGOS.ministerio),
  ])

  const numero = etiquetaNumero(ingreso)
  const anulado = ingreso.estado === "ANULADO"

  const lineas = ingreso.detalles.map((d) => {
    const cantidad = Number(d.cantidad)
    const precio = Number(d.precioUnitario)
    return { ...d, cantidad, precio, subtotal: cantidad * precio }
  })
  const total = lineas.reduce((suma, l) => suma + l.subtotal, 0)

  const encabezado: Content = {
    columns: [
      // Alto pedido en mm, convertido a pt y de ahí al ancho que conserva la
      // proporción de cada archivo (iniaf 900x387, ministerio 850x700).
      { image: logoIniaf, width: 99, alignment: "left" },
      {
        width: "*",
        stack: [
          { text: TITULO_DOCUMENTO, style: "titulo" },
          { text: ingreso.almacen.nombre.toUpperCase(), style: "subtitulo" },
          // El "Nº" va del mismo tamaño y peso que el número: en dos estilos
          // distintos queda como pegoteado de otro texto.
          {
            text: `Nº ${numero}`,
            fontSize: 13,
            bold: true,
            margin: [0, 3, 0, 0],
          },
          // Además de la marca de agua: en una fotocopia en blanco y negro el
          // gris claro puede perderse, este renglón no.
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

  // El NIT no es un campo del formulario (deriva del proveedor), pero un
  // documento fiscal lo lleva: va pegado al nombre en la misma celda.
  const proveedor = ingreso.proveedor
    ? ingreso.proveedor.nombre +
      (ingreso.proveedor.nit ? `  ·  NIT ${ingreso.proveedor.nit}` : "")
    : ""

  const datos: Content = {
    table: {
      // 12 columnas iguales: los anchos los declara cada campo con su colSpan,
      // copiando el orden y las proporciones del formulario.
      widths: Array.from({ length: 12 }, () => ANCHO_UTIL / 12),
      body: [
        // Mismo ORDEN que el formulario, pero en cuatro columnas iguales (3+3+
        // 3+3). En pantalla los recuadros de los inputs marcan las columnas y
        // anchos distintos por fila se ven bien; acá son rótulos sueltos, y si
        // cada fila empieza en otro punto el bloque queda desalineado.
        fila([
          [3, "Fecha de remisión", fecha(ingreso.fechaRemision)],
          [3, "Nota de remisión", ingreso.notaRemision ?? ""],
          [3, "Nº de factura", ingreso.numeroFactura ?? ""],
          [3, "Proveedor", proveedor],
        ]),
        fila([
          [3, "Fecha del informe/acta", fecha(ingreso.fechaInformeConformidad)],
          [3, "Informe/acta de conformidad", ingreso.informeConformidad ?? ""],
          [
            6,
            "Responsable / Comisión de recepción",
            ingreso.responsableConformidad?.nombre ?? "",
          ],
        ]),
        fila([
          // Sin la sigla: el nombre solo.
          [3, "Unidad solicitante", ingreso.unidadSolicitante?.nombre ?? ""],
          [3, "Proceso Nº / C31", ingreso.procesoC31 ?? ""],
          [3, "Certificación", ingreso.certificacion ?? ""],
          [
            3,
            "Fuente de financiamiento",
            ingreso.fuenteFinanciamiento?.nombre ?? "",
          ],
        ]),
      ],
    },
    // Solo una línea fina bajo cada fila; la de arriba de todo no se dibuja.
    layout: {
      hLineWidth: (i) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => "#bbbbbb",
      paddingTop: () => 4,
      paddingBottom: () => 2,
      paddingLeft: () => 0,
      paddingRight: () => 6,
    },
    margin: [0, 10, 0, 0],
  }

  // Mismas columnas que el reporte del sistema anterior. El ancho flexible se
  // lo lleva la descripción; el resto es fijo y suma con ella los 724 pt útiles.
  const cabeceraDetalle: TableCell[] = [
    { text: "Nº", style: "th", alignment: "center" },
    { text: "Ítem", style: "th" },
    { text: "Partida", style: "th", alignment: "center" },
    { text: "Código", style: "th" },
    { text: "Unidad", style: "th", alignment: "center" },
    { text: "Cantidad", style: "th", alignment: "right" },
    { text: "P. unitario", style: "th", alignment: "right" },
    { text: "Total", style: "th", alignment: "right" },
  ]

  const detalle: Content = {
    table: {
      // La cabecera se repite sola en cada hoja cuando el detalle es largo.
      headerRows: 1,
      widths: [20, "*", 45, 80, 50, 58, 65, 68],
      body: [
        cabeceraDetalle,
        ...lineas.map((linea, indice): TableCell[] => [
          { text: String(indice + 1), alignment: "center" },
          {
            // La observación de la línea se imprime pegada a la descripción,
            // como en el sistema anterior: "BOTAS DE AGUA (COLOR NEGRO)".
            text: linea.observacion
              ? `${linea.item.descripcion} (${linea.observacion})`
              : linea.item.descripcion,
          },
          {
            text: linea.item.partida?.codigo ?? "",
            alignment: "center",
            noWrap: true,
          },
          { text: linea.item.codigo, noWrap: true },
          { text: linea.item.unidadMedida, alignment: "center" },
          { text: moneda(linea.cantidad), alignment: "right" },
          { text: moneda(linea.precio), alignment: "right" },
          { text: moneda(linea.subtotal), alignment: "right" },
        ]),
        [
          {
            text: "TOTAL Bs",
            colSpan: 7,
            alignment: "right",
            bold: true,
          },
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

  // Antecedentes y firmas en un solo recuadro, como el reporte anterior: el
  // texto arriba, espacio en blanco para firmar y sellar, y los cargos abajo.
  const antecedentes: Content = {
    table: {
      widths: ["*"],
      body: [
        [{ text: "ANTECEDENTES:", bold: true, fontSize: 7 }],
        [{ text: ingreso.observacion ?? " " }],
        [
          {
            columns: FIRMAS.map((firma) => ({
              text: firma,
              alignment: "center" as const,
              bold: true,
            })),
            // El margen superior es el espacio para firmar (~30 mm).
            margin: [0, 85, 0, 2],
          },
        ],
      ],
    },
    layout: {
      // Todas las líneas, incluida la de abajo: el espacio para firmar y los
      // cargos van en la MISMA celda (separados por un margen), así que no hay
      // ninguna raya que suprimir entre ellos.
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
    },
    unbreakable: true,
    margin: [0, 8, 0, 0],
  }

  const avisoAnulacion: Content[] = anulado
    ? [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: [
                    { text: "ANULADO", bold: true },
                    ingreso.anuladoPor
                      ? ` por ${ingreso.anuladoPor.nombre}`
                      : "",
                    ingreso.anuladoEn
                      ? ` el ${fechaHora(ingreso.anuladoEn)}`
                      : "",
                    ingreso.motivoAnulacion
                      ? `. Motivo: ${ingreso.motivoAnulacion}`
                      : "",
                  ],
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
          margin: [0, 8, 0, 0],
        },
      ]
    : []

  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    // El visor del navegador usa este título en la pestaña, y es el nombre que
    // propone al descargar.
    info: {
      title: `Nota de ingreso ${numero.replace("/", "-")}`,
      subject: `Ingreso de almacén ${numero} — ${ingreso.almacen.nombre}`,
      creator: "Sistema de almacenes INIAF",
    },
    watermark: anulado
      ? { text: "ANULADO", color: "#999999", opacity: 0.25, bold: true, angle: -30 }
      : undefined,
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
      // Raya bajo el membrete, de margen a margen.
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: ANCHO_UTIL, y2: 0, lineWidth: 1.5 },
        ],
        margin: [0, 6, 0, 0],
      },
      datos,
      detalle,
      literal,
      antecedentes,
      ...avisoAnulacion,
    ],
    footer: (paginaActual, totalPaginas) => ({
      columns: [
        {
          text:
            `Registrado por ${ingreso.registradoPor.nombre} el ${fechaHora(ingreso.createdAt)}` +
            ` · ${ingreso.almacen.nombre} · Sistema de almacenes INIAF`,
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
