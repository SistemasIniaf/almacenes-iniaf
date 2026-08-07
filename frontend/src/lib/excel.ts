import { logosMembrete } from "@/lib/pdf"

import type ExcelJs from "exceljs"
import type { PaperSize, Workbook, Worksheet } from "exceljs"

/**
 * Base compartida de los reportes en EXCEL, hermana de `lib/pdf.ts`: acá vive
 * cómo se carga la librería, cómo se arma el membrete y cómo se descarga el
 * archivo. El maquetado de cada reporte va en su propio archivo.
 *
 * Los reportes salen **igual que en PDF** (logos, título, membrete y tabla) por
 * pedido de la institución: el Excel es el mismo documento, no una exportación
 * de datos pelada. Lo que sí se agrega, porque es gratis y es la razón por la
 * que alguien pide Excel: la tabla queda con **autofiltro**, con la fila de
 * encabezados **congelada** y con los importes como NÚMEROS de verdad — así se
 * puede ordenar, filtrar y sumar sin tener que reescribir nada.
 */

/** Fuente de todo el documento; la misma que usan los PDF. */
export const FUENTE_EXCEL = "Helvetica"

/** Gris de los bordes de tabla, el mismo `#999999` de los PDF. */
const GRIS_BORDE = "FF999999"
/** Relleno de la fila de encabezados. */
const GRIS_ENCABEZADO = "FFEFEFEF"

/**
 * Carga ExcelJS.
 *
 * Se importa por su NOMBRE y no por la ruta del bundle: el `package.json` de
 * exceljs declara `browser: ./dist/exceljs.min.js`, así que Vite ya sustituye
 * la build de Node —que arrastra `stream` y `fs` y no compila— por la del
 * navegador. Importar la ruta a mano funcionaría igual, pero se queda sin tipos.
 *
 * Es UMD, así que según cómo lo pre-empaquete el bundler la instancia puede
 * venir en `.default`: el mismo interop que ya nos mordió con pdfmake.
 *
 * El `import()` es dinámico para que no pese en el bundle de quien no exporta.
 */
export async function cargarExcelJs(): Promise<typeof ExcelJs> {
  const modulo = await import("exceljs")
  const conDefault = modulo as unknown as { default?: typeof ExcelJs }
  return conDefault.default ?? (modulo as unknown as typeof ExcelJs)
}

/** Convierte una data URL (lo que devuelve `logosMembrete`) al base64 pelado. */
const soloBase64 = (dataUrl: string) => dataUrl.split(",")[1] ?? ""

/**
 * Ancho aproximado de una columna en PÍXELES. Excel las mide en «caracteres»
 * (unos 7 px cada uno con la fuente por defecto); no hace falta más precisión
 * porque esto solo ubica una imagen.
 */
const anchoPx = (ancho: number) => ancho * 7

/**
 * Índice FRACCIONARIO de columna donde tiene que arrancar una imagen para que
 * termine pegada al borde derecho de la tabla.
 *
 * Hace falta porque `tl.col` de ExcelJS es un índice de COLUMNA, no una
 * posición: dónde cae depende de los anchos de las columnas anteriores, que
 * cambian de un reporte a otro. Un número fijo dejaba el logo del Ministerio
 * bien en un reporte y en el medio del título en el siguiente.
 */
function anclaDerecha(anchos: number[], anchoImagen: number): number {
  const total = anchos.reduce((suma, a) => suma + anchoPx(a), 0)
  const inicio = Math.max(total - anchoImagen, 0)

  let acumulado = 0
  for (let i = 0; i < anchos.length; i += 1) {
    const px = anchoPx(anchos[i])
    if (acumulado + px > inicio) return i + (inicio - acumulado) / px
    acumulado += px
  }
  return Math.max(anchos.length - 1, 0)
}

interface OpcionesMembrete {
  titulo: string
  /** Reemplaza al «AL: …» cuando el reporte es de un período. */
  leyenda?: string
  /**
   * Los anchos de TODAS las columnas del reporte, en el orden en que se
   * declaran. No alcanza con la cantidad: de acá sale dónde ubicar el logo de
   * la derecha (ver `anclaDerecha`).
   */
  anchos: number[]
}

/**
 * Dibuja el membrete: logo del INIAF a la izquierda, el del Ministerio a la
 * derecha y el título al centro. Devuelve **en qué fila sigue el contenido**.
 *
 * Las imágenes en Excel NO son contenido de celda: son objetos anclados que
 * flotan sobre la grilla. Por eso las filas del bloque llevan alto fijo — si se
 * dejara el automático, el logo taparía las primeras filas de datos.
 */
export async function membreteExcel(
  workbook: Workbook,
  hoja: Worksheet,
  { titulo, leyenda, anchos }: OpcionesMembrete
): Promise<number> {
  const logos = await logosMembrete()
  const ANCHO_INIAF = 150
  const ANCHO_MINISTERIO = 130

  const idIniaf = workbook.addImage({
    base64: soloBase64(logos.iniaf),
    extension: "png",
  })
  const idMinisterio = workbook.addImage({
    base64: soloBase64(logos.ministerio),
    extension: "png",
  })

  // Cuatro filas de membrete, con alto fijo para que los logos tengan lugar.
  for (let fila = 1; fila <= 4; fila += 1) hoja.getRow(fila).height = 18

  hoja.addImage(idIniaf, {
    tl: { col: 0.2, row: 0.2 },
    ext: { width: ANCHO_INIAF, height: 55 },
  })
  hoja.addImage(idMinisterio, {
    tl: { col: anclaDerecha(anchos, ANCHO_MINISTERIO), row: 0.2 },
    ext: { width: ANCHO_MINISTERIO, height: 55 },
  })

  /**
   * El título se combina sobre TODAS las columnas y se centra, igual que en el
   * PDF: queda en el medio de la hoja y los logos flotan sobre las dos puntas.
   * Antes se combinaba sobre unas columnas del medio elegidas a ojo, que con
   * anchos distintos dejaba el título corrido.
   */
  const centro = (
    fila: number,
    texto: string,
    tamano: number,
    negrita = true
  ) => {
    hoja.mergeCells(fila, 1, fila, anchos.length)
    const celda = hoja.getCell(fila, 1)
    celda.value = texto
    celda.font = { name: FUENTE_EXCEL, size: tamano, bold: negrita }
    celda.alignment = { horizontal: "center", vertical: "middle" }
  }

  centro(2, titulo, 12)
  if (leyenda) centro(3, leyenda, 9, false)

  return 6 // una fila en blanco entre el membrete y los datos
}

/**
 * Escribe las líneas de OFICINA / GESTIÓN. Devuelve la fila siguiente.
 *
 * Un valor NUMÉRICO se escribe como número y con formato `0`. Parece un detalle
 * y no lo es: escribir la gestión como texto («2026») hace que Excel le ponga
 * el triangulito verde de «número guardado como texto» en la esquina, que se lee
 * como que el reporte tiene un error. El formato `0` evita, además, que la
 * muestre como «2.026».
 */
export function datosCabeceraExcel(
  hoja: Worksheet,
  desde: number,
  lineas: { rotulo: string; valor: string | number }[]
): number {
  let fila = desde
  for (const { rotulo, valor } of lineas) {
    const celdaRotulo = hoja.getCell(fila, 1)
    celdaRotulo.value = rotulo
    celdaRotulo.font = { name: FUENTE_EXCEL, size: 9, bold: true }

    const celdaValor = hoja.getCell(fila, 2)
    celdaValor.value = valor
    celdaValor.font = { name: FUENTE_EXCEL, size: 9 }
    if (typeof valor === "number") celdaValor.numFmt = "0"

    fila += 1
  }
  return fila + 1
}

/** Borde fino gris en las cuatro caras, igual que el `layout` de los PDF. */
export const BORDE_TABLA = {
  top: { style: "thin" as const, color: { argb: GRIS_BORDE } },
  left: { style: "thin" as const, color: { argb: GRIS_BORDE } },
  bottom: { style: "thin" as const, color: { argb: GRIS_BORDE } },
  right: { style: "thin" as const, color: { argb: GRIS_BORDE } },
}

/** Formatos de número de Excel, espejo de los de `lib/formato.ts`. */
export const FORMATO_MONEDA = "#,##0.00;[Red]-#,##0.00"
/** Precio unitario: 2 decimales de piso y hasta 5, sin ceros de relleno. */
export const FORMATO_PRECIO = "#,##0.00###"
export const FORMATO_FECHA = "dd/mm/yyyy"

/**
 * Cantidad: entera sin decimales, fraccionaria con hasta 2 — el mismo criterio
 * que `cantidad()` en pantalla (se cuentan paquetes y piezas, así que «50,00
 * PAQUETE» sobra).
 *
 * Es una FUNCIÓN y no una cadena fija porque Excel no sabe expresarlo: con
 * `#,##0.##` un entero sale como **`50,`** — el separador decimal queda dibujado
 * aunque no haya decimales que mostrar, y no hay condición de formato que
 * distinga «es entero». Así que el formato se elige por celda, mirando el valor.
 */
export const FORMATO_CANTIDAD = (valor: number) =>
  Number.isInteger(valor) ? "#,##0" : "#,##0.##"

export interface ColumnaExcel {
  header: string
  /** Ancho en «caracteres», la unidad de Excel. */
  width: number
  align?: "left" | "center" | "right"
  /**
   * `numFmt` de las celdas de datos. Con una función, se resuelve por celda
   * mirando el valor — lo necesita la cantidad (ver `FORMATO_CANTIDAD`).
   */
  formato?: string | ((valor: number) => string)
}

/** Valor que se puede escribir en una celda de datos. */
type ValorCelda = string | number | Date | null

/**
 * Constructor de la tabla de un reporte.
 *
 * Existe porque los cinco reportes tienen la MISMA estructura —encabezado, filas
 * de datos, encabezados de grupo, subtotales y total general— y escribirla cinco
 * veces garantizaba que se fueran despegando entre sí. Cada reporte se queda solo
 * con sus columnas y su recorrido.
 *
 * Las filas van PLANAS, como en el PDF (decisión del usuario): los grupos se
 * marcan con una fila de encabezado sombreada, no con el agrupador plegable de
 * Excel. Así el papel y la planilla se leen igual.
 */
export function crearTabla(
  hoja: Worksheet,
  columnas: ColumnaExcel[],
  filaEncabezado: number
) {
  const n = columnas.length
  let fila = filaEncabezado

  hoja.getRow(filaEncabezado).values = columnas.map((c) => c.header)
  estiloEncabezado(hoja, filaEncabezado, n)

  /** Pinta bordes y fuente en todas las celdas de una fila. */
  const marcar = (numeroFila: number, opciones: { gris?: boolean } = {}) => {
    const renglon = hoja.getRow(numeroFila)
    for (let col = 1; col <= n; col += 1) {
      const celda = renglon.getCell(col)
      celda.border = BORDE_TABLA
      celda.font = {
        name: FUENTE_EXCEL,
        size: 9,
        color: opciones.gris ? { argb: "FF999999" } : undefined,
      }
    }
    return renglon
  }

  return {
    /** Una fila de datos. Alineación y formato salen de la definición de columna. */
    fila(valores: ValorCelda[], opciones: { gris?: boolean } = {}) {
      fila += 1
      const renglon = hoja.getRow(fila)
      renglon.values = valores
      marcar(fila, opciones)
      columnas.forEach((columna, indice) => {
        const celda = renglon.getCell(indice + 1)
        if (columna.align) celda.alignment = { horizontal: columna.align }
        if (!columna.formato) return
        const valor = valores[indice]
        celda.numFmt =
          typeof columna.formato === "function"
            ? columna.formato(typeof valor === "number" ? valor : 0)
            : columna.formato
      })
      return renglon
    },

    /** Encabezado de grupo: una sola celda combinada a lo ancho, sombreada. */
    grupo(texto: string) {
      fila += 1
      marcar(fila)
      hoja.mergeCells(fila, 1, fila, n)
      const celda = hoja.getCell(fila, 1)
      celda.value = texto
      celda.font = { name: FUENTE_EXCEL, size: 9, bold: true }
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE4E4E4" },
      }
    },

    /**
     * Subtotal o total: rótulo a la derecha sobre las columnas de la izquierda y
     * el monto en la última. `destacado` lo deja sin sombreado, para el total
     * general.
     */
    resumen(
      etiqueta: string,
      monto: number,
      opciones: { destacado?: boolean; formula?: string } = {}
    ) {
      const { destacado = false, formula } = opciones
      fila += 1
      marcar(fila)
      hoja.mergeCells(fila, 1, fila, n - 1)
      const rotulo = hoja.getCell(fila, 1)
      rotulo.value = etiqueta
      rotulo.font = { name: FUENTE_EXCEL, size: 9, bold: true }
      rotulo.alignment = { horizontal: "right" }

      const celda = hoja.getCell(fila, n)
      // Con fórmula el total SIGUE a los datos: si alguien corrige una fila o
      // filtra, se recalcula. El `result` es para que se vea sin abrir Excel.
      celda.value = formula ? { formula, result: monto } : monto
      celda.numFmt = FORMATO_MONEDA
      celda.font = { name: FUENTE_EXCEL, size: 9, bold: true }
      celda.alignment = { horizontal: "right" }

      if (!destacado) {
        const relleno = {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FFF4F4F4" },
        }
        rotulo.fill = relleno
        celda.fill = relleno
      }
    },

    /** Una fila suelta de texto (notas al pie), sin bordes. */
    nota(texto: string) {
      fila += 2
      const celda = hoja.getCell(fila, 1)
      celda.value = texto
      celda.font = {
        name: FUENTE_EXCEL,
        size: 8,
        italic: true,
        color: { argb: "FF666666" },
      }
      return fila
    },

    /** En qué fila quedó parada la tabla. */
    get ultimaFila() {
      return fila
    },
  }
}

/** Da formato a la fila de encabezados de una tabla. */
export function estiloEncabezado(
  hoja: Worksheet,
  fila: number,
  columnas: number
) {
  const renglon = hoja.getRow(fila)
  for (let col = 1; col <= columnas; col += 1) {
    const celda = renglon.getCell(col)
    celda.font = { name: FUENTE_EXCEL, size: 9, bold: true }
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GRIS_ENCABEZADO },
    }
    celda.border = BORDE_TABLA
    celda.alignment = { vertical: "middle", wrapText: true }
  }
  renglon.height = 20
}

/**
 * Deja la hoja lista para IMPRIMIRSE parecido al PDF: apaisada, ajustada al
 * ancho de una página y repitiendo la fila de encabezados en cada hoja.
 */
export function prepararImpresion(hoja: Worksheet, filaEncabezado: number) {
  hoja.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    // `PaperSize` es un `const enum`, así que no se puede usar como VALOR con
    // `isolatedModules` (Vite): se escribe el número y se castea al tipo.
    paperSize: 1 as PaperSize, // Carta
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  }
  hoja.headerFooter = {
    oddFooter: "&LSistema de almacenes INIAF&RPágina &P de &N",
  }
  hoja.pageSetup.printTitlesRow = `${filaEncabezado}:${filaEncabezado}`
}

/**
 * Descarga el libro. Se arma un Blob y se dispara un `<a download>`: a
 * diferencia de los PDF, un Excel no se puede «ver» en una pestaña — el
 * navegador no lo renderiza, así que abrir una sería dejarla en blanco.
 */
export async function descargarExcel(workbook: Workbook, nombre: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()

  // Se libera después del clic: revocarla en el mismo tick cancela la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
