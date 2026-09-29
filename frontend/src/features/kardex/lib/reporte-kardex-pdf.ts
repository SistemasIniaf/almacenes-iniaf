import {
  ALTO_MEMBRETE,
  ANCHO_UTIL_APAISADO,
  fechaCorta,
  membreteRepetido,
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
import type {
  Content,
  ContentColumns,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces"

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

/**
 * Celda numérica que no aplica en ese renglón (una entrada no tiene salida).
 *
 * Va con guion y NO en blanco: es un documento que se archiva firmado, y un
 * hueco vacío en una columna de cantidades se puede completar a mano después.
 * Es la misma razón por la que el pie lleva la línea de observaciones rayada.
 */
const SIN_VALOR = "—"

/**
 * `YYYY-MM-DD` → 01/01/2026, partiendo la cadena y sin pasar por `Date`: la
 * conversión a hora local correría el día en un huso negativo.
 */
const fechaIso = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

/**
 * El PERÍODO que cubre el libro. Sin rango es la gestión entera; con rango, los
 * extremos — que es además lo que mueve el saldo de apertura.
 */
function periodo(reporte: ReporteKardex): string {
  const { desde, hasta } = reporte.filtros
  if (desde && hasta) return `DEL ${fechaIso(desde)} AL ${fechaIso(hasta)}`
  if (desde) return `DESDE EL ${fechaIso(desde)} · GESTIÓN ${reporte.gestion}`
  if (hasta) return `HASTA EL ${fechaIso(hasta)} · GESTIÓN ${reporte.gestion}`
  return `GESTIÓN ${reporte.gestion}`
}

/**
 * Leyenda del membrete: ALMACÉN y PERÍODO, los dos datos que valen para el
 * documento ENTERO.
 *
 * Van acá y no en una línea aparte porque el membrete se repite en todas las
 * páginas, y cada bloque arranca en hoja nueva: si el almacén fuera al pie del
 * membrete, a partir de la segunda hoja no se sabría de qué almacén es el libro.
 */
const leyendaMembrete = (reporte: ReporteKardex) =>
  `${reporte.almacen.nombre.toUpperCase()} · ${periodo(reporte)}`

/**
 * Los filtros que ACOTAN el reporte, solo si se aplicó alguno.
 *
 * Nombra únicamente fuente e ítem, y solo cuando están filtrados: cada bloque ya
 * dice SU fuente y SU ítem, así que agregar «FUENTE: Todas» al lado de un bloque
 * que dice «FUENTE: BANCO MUNDIAL» se lee como una contradicción. Sin filtros
 * devuelve `null` y no se dibuja nada — el alcance completo ya lo dice el
 * membrete.
 */
function filtrosAplicados(reporte: ReporteKardex): Content | null {
  const { fuente, item } = reporte.filtros
  if (!fuente && !item) return null

  const partes: string[] = []
  if (item) partes.push(`ÍTEM: ${item.codigo} — ${item.descripcion}`)
  if (fuente) partes.push(`FUENTE: ${fuente.nombre}`)

  return {
    text: [{ text: "Filtrado por — ", bold: true }, partes.join("   ·   ")],
    fontSize: 7.5,
    color: "#444444",
    margin: [0, 6, 0, 0],
  }
}

/**
 * Rótulos del pie de firmas. Son cargos fijos, no salen de la base — los mismos
 * que usa la nota de ingreso (`FIRMAS` en `nota-ingreso-pdf.ts`).
 *
 * El reporte del sistema anterior escribía «Encargado de Almacen» y «V°B° Jefe
 * Administrativo»; acá van con la ortografía que ya usa el resto del sistema,
 * que es la misma persona con el mismo cargo.
 */
const FIRMAS_KARDEX = ["Encargado Almacén", "VoBo Jefe Administrativo"]

/**
 * Aire entre la línea de observaciones y los rótulos: el lugar donde se firma a
 * mano. 78 pt ≈ 2,75 cm, para que entren una firma y el sello encima del cargo.
 */
const ESPACIO_FIRMA = 78

/**
 * Cierre de un bloque: la línea de observaciones, el espacio para firmar a mano
 * y los dos cargos.
 *
 * **Va pegado a la tabla del bloque, en el CONTENIDO, y no en el `footer`.** Se
 * probó al pie de la página (que es lo que repite pdfmake en cada hoja) y quedó
 * mal: en un bloque corto —lo normal, un ítem con pocos movimientos— el pie caía
 * al fondo de la hoja, a media página de la tabla, y se leía como suelto. Como
 * cada bloque arranca en hoja nueva, ponerlo detrás de la tabla igual da uno por
 * hoja en el caso normal, y encima donde termina de leerse.
 *
 * **Va `unbreakable`**: la línea de observaciones en una hoja y las firmas en la
 * siguiente no sirven para firmar nada.
 *
 * Límite conocido: si los movimientos de UN ítem no entran en una hoja, el
 * cierre sale solo al final del bloque, así que las hojas del medio quedan sin
 * firmas. Es como salía el reporte del sistema anterior.
 */
function cierreBloque(): Content {
  return {
    stack: [
      {
        text: `Observaciones: ${"_".repeat(110)}`,
        fontSize: 7,
        color: "#666666",
      },
      {
        // Centrados en media hoja cada uno. El margen de arriba ES el espacio
        // para firmar (ver `ESPACIO_FIRMA`).
        columns: FIRMAS_KARDEX.map((cargo) => ({
          text: cargo,
          alignment: "center" as const,
        })),
        fontSize: 7.5,
        margin: [0, ESPACIO_FIRMA, 0, 0],
      },
    ],
    margin: [0, 8, 0, 0],
    unbreakable: true,
  }
}

/**
 * Ficha del bloque: lo que identifica a ESE ítem con ESA fuente.
 *
 * NO lleva el almacén: es el mismo para todo el reporte y ya está en el
 * membrete, que además se repite en cada página. Repetirlo por bloque era lo que
 * hacía ver la primera hoja como datos duplicados.
 */
// Tipado explícito a `ContentColumns` (no al `Content` genérico): `content.push({
// ...cabeceraBloque(bloque), ...})` necesita saber que esto es un objeto — `Content`
// es una unión que también admite `string`/`number`, y spreadear eso no tipa.
function cabeceraBloque(bloque: BloqueReporteKardex): ContentColumns {
  const dato = (etiqueta: string, valor: string) => ({
    text: [{ text: `${etiqueta}: `, bold: true }, valor],
    fontSize: 7,
  })

  return {
    columns: [
      { ...dato("CÓDIGO", bloque.item.codigo), width: 100 },
      { ...dato("ÍTEM", bloque.item.descripcion), width: "*" },
      { ...dato("PARTIDA", bloque.item.partida.codigo), width: 70 },
      { ...dato("UNIDAD", bloque.item.unidadMedida), width: 80 },
      {
        ...dato("FUENTE", bloque.fuente?.nombre ?? "SIN FUENTE"),
        width: 180,
      },
    ],
    columnGap: 6,
    margin: [0, 8, 0, 3],
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
    // P/U, INGRESO y EGRESO no aplican en la apertura: es un saldo arrastrado,
    // no un movimiento. Con guion, no en blanco.
    { text: SIN_VALOR, alignment: "right", italics: true },
    { text: SIN_VALOR, alignment: "right", italics: true },
    { text: SIN_VALOR, alignment: "right", italics: true },
    {
      text: moneda(bloque.valorInicial),
      alignment: "right",
      italics: true,
    },
  ])

  for (const m of bloque.movimientos) {
    // La reversión se marca: deshace un movimiento anterior, así que su
    // cantidad cae en la columna contraria a la que uno esperaría por el tipo
    // de documento. Sin la marca, un renglón «E» con la cantidad en ENTRADA se
    // lee como un error del reporte.
    const esReversion = m.origen === "R"
    const estilo = esReversion ? { italics: true, color: "#8a4b00" } : undefined

    cuerpo.push([
      { text: fechaIso(m.fecha), alignment: "center", ...estilo },
      { text: m.documento ?? "—", alignment: "center", ...estilo },
      { text: m.origen, alignment: "center", bold: esReversion, ...estilo },
      { text: m.detalle, ...estilo },
      {
        text: m.entrada ? cantidad(m.entrada) : SIN_VALOR,
        alignment: "right",
        ...estilo,
      },
      {
        text: m.salida ? cantidad(m.salida) : SIN_VALOR,
        alignment: "right",
        ...estilo,
      },
      { text: cantidad(m.saldo), alignment: "right", ...estilo },
      { text: precio(m.precioUnitario), alignment: "right", ...estilo },
      {
        text: m.valorEntrada ? moneda(m.valorEntrada) : SIN_VALOR,
        alignment: "right",
        ...estilo,
      },
      {
        text: m.valorSalida ? moneda(m.valorSalida) : SIN_VALOR,
        alignment: "right",
        ...estilo,
      },
      { text: moneda(m.valorSaldo), alignment: "right", ...estilo },
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
    {
      text: cantidad(totales.entradas),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {
      text: cantidad(totales.salidas),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {
      text: cantidad(totales.saldo),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    // P/U no se totaliza: un promedio de precios no significa nada.
    {
      text: SIN_VALOR,
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {
      text: moneda(totales.valorEntradas),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {
      text: moneda(totales.valorSalidas),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
    {
      text: moneda(totales.valorSaldo),
      alignment: "right",
      bold: true,
      fillColor: "#f4f4f4",
    },
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
      ...cabeceraBloque(bloque),
      // Cada bloque arranca en hoja nueva menos el primero: así un ítem no
      // queda partido entre dos páginas y el archivo se puede separar por ítem,
      // que es como se guardaba el kardex en papel.
      ...(indice > 0 ? { pageBreak: "before" as const } : {}),
    })
    contenido.push(tablaBloque(bloque, reporte.gestion))
    contenido.push(cierreBloque())
  })

  return {
    // Apaisada: doce columnas no entran en una Carta vertical.
    pageSize: "LETTER",
    pageOrientation: "landscape",
    // El margen superior le reserva el lugar al membrete, que va como `header`
    // para repetirse en TODAS las páginas: cada bloque empieza en hoja nueva y
    // una hoja de kardex sin membrete no se puede identificar.
    pageMargins: [
      MARGEN_PDF,
      MARGEN_PDF + ALTO_MEMBRETE,
      MARGEN_PDF,
      MARGEN_PDF + 6,
    ],
    info: {
      title: `Kardex ${reporte.gestion} — ${fechaCorta(emitidoEn)}`,
      creator: "Sistema de almacenes INIAF",
    },
    defaultStyle: { font: "Helvetica", fontSize: 7, lineHeight: 1.05 },
    styles: { th: { bold: true, fontSize: 7 } },
    header: membreteRepetido("KARDEX DE ALMACÉN", logos, emitidoEn, {
      leyenda: leyendaMembrete(reporte),
      ancho: ANCHO_UTIL_APAISADO,
    }),
    content: [
      // Solo si se filtró algo; si no, `null` y se descarta.
      ...([filtrosAplicados(reporte)].filter(Boolean) as Content[]),
      ...(reporte.bloques.length === 0
        ? [
            {
              text: "Sin movimientos para los filtros elegidos.",
              italics: true,
            } as Content,
          ]
        : contenido),
    ],
    footer: pieReporte(usuario, emitidoEn),
  }
}
