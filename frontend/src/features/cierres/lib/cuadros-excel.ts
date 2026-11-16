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
import {
  BORDE_TABLA,
  cargarExcelJs,
  descargarExcel,
  estiloEncabezado,
  FORMATO_CANTIDAD,
  FORMATO_MONEDA,
  FORMATO_PRECIO,
  FUENTE_EXCEL,
  prepararImpresion,
} from "@/lib/excel"
import { logosMembrete } from "@/lib/pdf"

import type { DatosCuadros } from "@/features/cierres/cierres.types"
import type { NumeroCuadro } from "@/features/cierres/lib/cuadros"
import type { Workbook, Worksheet } from "exceljs"

/**
 * Cuadros 5 y 6 en Excel, con la MISMA grilla que la planilla del Ministerio
 * (mismas columnas, mismo orden, encabezado de dos filas en el 6): el uso es
 * copiar los números a la planilla oficial, así que cada columna tiene que caer
 * donde la busca quien copia. Importes y cantidades son NÚMEROS, y el TOTAL es
 * una fórmula `SUM`.
 */

const fuente = (size = 9, bold = false) => ({ name: FUENTE_EXCEL, size, bold })

/** Membrete al estilo de la planilla. Devuelve la fila donde va la tabla. */
async function membrete(
  workbook: Workbook,
  hoja: Worksheet,
  numero: NumeroCuadro,
  datos: DatosCuadros,
  columnas: number
): Promise<number> {
  const { iniaf, proporciones } = await logosMembrete()
  const alto = 46
  const ancho = Math.min(Math.round(alto * proporciones.iniaf), 150)
  const id = workbook.addImage({
    base64: iniaf.split(",")[1] ?? "",
    extension: "png",
  })
  hoja.getRow(1).height = 20
  hoja.getRow(2).height = 20
  hoja.addImage(id, {
    tl: { col: 0.1, row: 0.1 },
    ext: { width: ancho, height: Math.round(ancho / proporciones.iniaf) },
  })

  const codigo = hoja.getCell(1, columnas)
  codigo.value = CUADRO[numero].codigo
  codigo.font = fuente(9, true)
  codigo.alignment = { horizontal: "right" }
  const version = hoja.getCell(2, columnas)
  version.value = VERSION
  version.font = fuente(9)
  version.alignment = { horizontal: "right" }

  const centro = (fila: number, texto: string, size: number, bold: boolean) => {
    hoja.mergeCells(fila, 1, fila, columnas)
    const c = hoja.getCell(fila, 1)
    c.value = texto
    c.font = fuente(size, bold)
    c.alignment = { horizontal: "center" }
  }
  centro(3, ENTIDAD, 11, true)
  centro(4, CUADRO[numero].titulo, 11, true)
  centro(5, `Al 31 de diciembre de ${datos.gestion}`, 10, false)
  centro(6, "(Expresado en Bolivianos)", 9, false)

  let fila = 8
  const linea = (
    texto: string,
    color?: string,
    bold = false,
    alto?: number
  ) => {
    hoja.mergeCells(fila, 1, fila, columnas)
    const c = hoja.getCell(fila, 1)
    c.value = texto
    c.font = { ...fuente(9, bold), color: color ? { argb: color } : undefined }
    c.alignment = { wrapText: true, vertical: "top" }
    // Una celda combinada no crece sola con el texto: los avisos largos
    // necesitan el alto a mano o se cortan.
    if (alto) hoja.getRow(fila).height = alto
    fila += 1
  }
  linea(alcance(datos), undefined, true)
  const provisional = avisoProvisional(datos)
  if (provisional) linea(provisional, "FFB00020", true, 26)
  const anticipado = avisoAnticipado(datos)
  if (anticipado) linea(anticipado, "FF8A5A00", false, 26)
  return fila + 1
}

/** Bordes y fuente en una fila de la tabla. */
function marcar(hoja: Worksheet, fila: number, columnas: number) {
  for (let col = 1; col <= columnas; col += 1) {
    const c = hoja.getCell(fila, col)
    c.border = BORDE_TABLA
    c.font = fuente(9)
  }
}

function numero(
  hoja: Worksheet,
  fila: number,
  col: number,
  valor: number,
  formato: string
) {
  const c = hoja.getCell(fila, col)
  c.value = valor
  c.numFmt = formato
  c.alignment = { horizontal: "right" }
}

/** Notas del Ministerio al pie, cada una en su fila combinada. */
function notas(hoja: Worksheet, desde: number, columnas: number) {
  let fila = desde + 2
  for (const texto of NOTAS_MINISTERIO) {
    hoja.mergeCells(fila, 1, fila, columnas)
    const c = hoja.getCell(fila, 1)
    c.value = texto
    c.font = { ...fuente(8), italic: true }
    c.alignment = { wrapText: true, vertical: "top" }
    hoja.getRow(fila).height = 26
    fila += 1
  }
}

function nuevoLibro(ExcelJS: Awaited<ReturnType<typeof cargarExcelJs>>) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = new Date()
  // Que Excel recalcule los TOTAL al abrir: ExcelJS no guarda un resultado 0.
  workbook.calcProperties.fullCalcOnLoad = true
  return workbook
}

// --- Cuadro 5 -----------------------------------------------------------------

async function cuadro5(datos: DatosCuadros) {
  const ExcelJS = await cargarExcelJs()
  const workbook = nuevoLibro(ExcelJS)
  const hoja = workbook.addWorksheet("Cuadro 5", {
    views: [{ showGridLines: false }],
  })
  const anchos = [6, 48, 15, 17, 15, 17]
  hoja.columns = anchos.map((width) => ({ width }))
  const n = anchos.length
  const g = datos.gestion

  const encabezado = await membrete(workbook, hoja, 5, datos, n)
  hoja.getRow(encabezado).values = [
    "Nº",
    "Partida",
    `Cantidad Inicial\nal 01/01/${g}`,
    `Saldo Inicial\nal 01/01/${g}\n(Bs)`,
    `Cantidad Final\nal 31/12/${g}`,
    `Saldo Final\nal 31/12/${g}\n(Bs)`,
  ]
  estiloEncabezado(hoja, encabezado, n)
  hoja.getRow(encabezado).height = 42
  for (let col = 1; col <= n; col += 1)
    hoja.getCell(encabezado, col).alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    }

  const filas = agruparCuadro5(datos.filas)
  let fila = encabezado
  filas.forEach((f, i) => {
    fila += 1
    marcar(hoja, fila, n)
    hoja.getCell(fila, 1).value = i + 1
    hoja.getCell(fila, 1).alignment = { horizontal: "center" }
    hoja.getCell(fila, 2).value =
      `${f.partidaCodigo} - ${f.partidaDenominacion}`
    numero(hoja, fila, 3, f.cantInicial, FORMATO_CANTIDAD(f.cantInicial))
    numero(hoja, fila, 4, f.valInicial, FORMATO_MONEDA)
    numero(hoja, fila, 5, f.cantFinal, FORMATO_CANTIDAD(f.cantFinal))
    numero(hoja, fila, 6, f.valFinal, FORMATO_MONEDA)
  })

  fila += 1
  marcar(hoja, fila, n)
  hoja.mergeCells(fila, 1, fila, 2)
  hoja.getCell(fila, 1).value = "TOTAL"
  hoja.getCell(fila, 1).alignment = { horizontal: "center" }
  for (const col of [4, 6]) {
    const letra = hoja.getColumn(col).letter
    const suma = filas.reduce(
      (s, f) => s + Math.round((col === 4 ? f.valInicial : f.valFinal) * 100),
      0
    )
    const c = hoja.getCell(fila, col)
    c.value = {
      formula: `SUM(${letra}${encabezado + 1}:${letra}${fila - 1})`,
      result: suma / 100,
    }
    c.numFmt = FORMATO_MONEDA
  }
  for (let col = 1; col <= n; col += 1)
    hoja.getCell(fila, col).font = fuente(9, true)

  notas(hoja, fila, n)
  hoja.views = [{ state: "frozen", ySplit: encabezado, showGridLines: false }]
  prepararImpresion(hoja, encabezado)
  hoja.pageSetup.orientation = "portrait"
  return workbook
}

// --- Cuadro 6 -----------------------------------------------------------------

async function cuadro6(datos: DatosCuadros) {
  const ExcelJS = await cargarExcelJs()
  const workbook = nuevoLibro(ExcelJS)
  const hoja = workbook.addWorksheet("Cuadro 6", {
    views: [{ showGridLines: false }],
  })
  const anchos = [6, 46, 12, 12, 11, 11, 11, 11, 14, 14, 14, 14]
  hoja.columns = anchos.map((width) => ({ width }))
  const n = anchos.length

  const arriba = await membrete(workbook, hoja, 6, datos, n)
  const abajo = arriba + 1
  hoja.getRow(arriba).values = [
    "Nº",
    "Descripción (Ítem)",
    "Unidad de medida",
    "Precio Unitario",
    "Cantidad",
    "",
    "",
    "",
    "Valores",
  ]
  hoja.getRow(abajo).values = [
    "",
    "",
    "",
    "",
    "Saldo Inicial",
    "Entradas",
    "Salidas",
    "Saldo Final",
    "Saldo Inicial",
    "Entradas",
    "Salidas",
    "Saldo Final",
  ]
  estiloEncabezado(hoja, arriba, n)
  estiloEncabezado(hoja, abajo, n)
  for (let col = 1; col <= 4; col += 1) hoja.mergeCells(arriba, col, abajo, col)
  hoja.mergeCells(arriba, 5, arriba, 8)
  hoja.mergeCells(arriba, 9, arriba, 12)
  for (const r of [arriba, abajo])
    for (let col = 1; col <= n; col += 1)
      hoja.getCell(r, col).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      }

  let fila = abajo
  datos.filas.forEach((f, i) => {
    fila += 1
    marcar(hoja, fila, n)
    hoja.getCell(fila, 1).value = i + 1
    hoja.getCell(fila, 1).alignment = { horizontal: "center" }
    hoja.getCell(fila, 2).value = f.descripcion
    hoja.getCell(fila, 3).value = f.unidadMedida
    hoja.getCell(fila, 3).alignment = { horizontal: "center" }
    numero(hoja, fila, 4, Number(f.precio), FORMATO_PRECIO)
    const cantidades = [
      f.cantInicial,
      f.cantEntradas,
      f.cantSalidas,
      f.cantFinal,
    ]
    cantidades.forEach((v, j) =>
      numero(hoja, fila, 5 + j, Number(v), FORMATO_CANTIDAD(Number(v)))
    )
    const valores = [f.valInicial, f.valEntradas, f.valSalidas, f.valFinal]
    valores.forEach((v, j) =>
      numero(hoja, fila, 9 + j, Number(v), FORMATO_MONEDA)
    )
  })

  fila += 1
  marcar(hoja, fila, n)
  hoja.mergeCells(fila, 1, fila, 8)
  hoja.getCell(fila, 1).value = "TOTAL"
  hoja.getCell(fila, 1).alignment = { horizontal: "center" }
  const t = totalesCuadro6(datos.filas)
  ;[t.inicial, t.entradas, t.salidas, t.final].forEach((monto, j) => {
    const col = 9 + j
    const letra = hoja.getColumn(col).letter
    const c = hoja.getCell(fila, col)
    c.value = {
      formula: `SUM(${letra}${abajo + 1}:${letra}${fila - 1})`,
      result: monto,
    }
    c.numFmt = FORMATO_MONEDA
  })
  for (let col = 1; col <= n; col += 1)
    hoja.getCell(fila, col).font = fuente(9, true)

  notas(hoja, fila, n)
  hoja.views = [{ state: "frozen", ySplit: abajo, showGridLines: false }]
  prepararImpresion(hoja, arriba)
  hoja.pageSetup.printTitlesRow = `${arriba}:${abajo}`
  return workbook
}

export async function descargarCuadroExcel(
  numeroCuadro: NumeroCuadro,
  datos: DatosCuadros
) {
  const workbook =
    numeroCuadro === 5 ? await cuadro5(datos) : await cuadro6(datos)
  await descargarExcel(workbook, `${nombreBase(numeroCuadro, datos)}.xlsx`)
}

/** Para las pruebas: el libro sin descargarlo. */
export function crearCuadroExcel(
  numeroCuadro: NumeroCuadro,
  datos: DatosCuadros
) {
  return numeroCuadro === 5 ? cuadro5(datos) : cuadro6(datos)
}
