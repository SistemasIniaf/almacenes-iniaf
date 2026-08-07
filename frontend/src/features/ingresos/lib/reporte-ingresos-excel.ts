import {
  BORDE_TABLA,
  cargarExcelJs,
  datosCabeceraExcel,
  descargarExcel,
  estiloEncabezado,
  FUENTE_EXCEL,
  membreteExcel,
  prepararImpresion,
} from "@/lib/excel"
import { esNacional, fechaCorta, numeroDocumento } from "@/lib/reporte-comun"
import { leyendaPeriodo } from "@/features/ingresos/lib/reporte-ingresos-pdf"

import type { DatosReporteIngresos } from "@/features/ingresos/lib/reporte-ingresos-pdf"

/**
 * El mismo «Registro de ingresos» del PDF, en Excel: mismo membrete, mismo
 * título, mismas columnas y mismo criterio con los anulados.
 *
 * Las tres diferencias son a favor del formato y no del maquetado:
 *
 * - **los importes son NÚMEROS**, no texto. Un total que no se puede sumar en
 *   Excel es una imagen de un total;
 * - la tabla lleva **autofiltro** y la fila de encabezados queda **congelada**;
 * - los anulados se marcan en gris y con una columna ESTADO propia. En el papel
 *   se distinguen por el importe entre paréntesis —convención contable—, pero
 *   acá eso convertiría la celda en texto y rompería lo primero. El paréntesis
 *   se consigue igual con el FORMATO de número, que deja el valor intacto.
 */

/** `YYYY-MM-DD` a Date local, sin que la zona horaria corra el día. */
const fechaIso = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Formato contable: los negativos/anulados entre paréntesis y en gris. */
const FORMATO_MONEDA = "#,##0.00;[Red]-#,##0.00"

export function nombreArchivoExcelIngresos(
  datos: DatosReporteIngresos
): string {
  const periodo = datos.desde ?? datos.emitidoEn.toISOString().slice(0, 10)
  return `registro-ingresos-${periodo}.xlsx`
}

export async function crearReporteIngresosExcel(datos: DatosReporteIngresos) {
  const ExcelJS = await cargarExcelJs()
  const { filas, almacen, emitidoEn, usuario, desde, hasta } = datos

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = emitidoEn

  const hoja = workbook.addWorksheet("Registro de ingresos", {
    views: [{ showGridLines: false }],
  })

  // Misma regla que el PDF: la columna Almacén solo aparece si el reporte
  // abarca varios; con uno filtrado repetiría el nombre en cada fila y ya está
  // arriba, en la línea OFICINA.
  const conAlmacen = esNacional(almacen)

  const columnas = [
    { header: "Nro", width: 6 },
    { header: "Nº INGRESO", width: 13 },
    { header: "FECHA", width: 12 },
    ...(conAlmacen ? [{ header: "ALMACÉN", width: 26 }] : []),
    { header: "OBSERVACIÓN", width: 60 },
    { header: "ESTADO", width: 12 },
    { header: "TOTAL Bs", width: 15 },
  ]
  hoja.columns = columnas.map((c) => ({ width: c.width }))

  const filaTabla = await membreteExcel(workbook, hoja, {
    titulo: "REGISTRO DE INGRESOS A ALMACÉN",
    leyenda: leyendaPeriodo(desde, hasta) ?? `AL: ${fechaCorta(emitidoEn)}`,
    anchos: columnas.map((c) => c.width),
  })

  const filaEncabezado = datosCabeceraExcel(hoja, filaTabla, [
    { rotulo: "OFICINA:", valor: almacen ?? "NACIONAL (todos los almacenes)" },
    // Número, no texto: si no, Excel marca la celda con el triangulito verde.
    { rotulo: "GESTIÓN:", valor: emitidoEn.getFullYear() },
  ])

  hoja.getRow(filaEncabezado).values = columnas.map((c) => c.header)
  estiloEncabezado(hoja, filaEncabezado, columnas.length)

  let total = 0
  let anulados = 0
  let montoAnulado = 0

  filas.forEach((fila, indice) => {
    const monto = Number(fila.total)
    const esAnulado = fila.estado === "ANULADO"
    if (esAnulado) {
      anulados += 1
      montoAnulado += monto
    } else {
      total += monto
    }

    const renglon = hoja.getRow(filaEncabezado + 1 + indice)
    renglon.values = [
      indice + 1,
      numeroDocumento(fila),
      fechaIso(fila.fechaIngreso),
      ...(conAlmacen ? [fila.almacen.nombre] : []),
      fila.observacion ?? "",
      esAnulado ? "ANULADO" : "CONFIRMADO",
      // El anulado va en NEGATIVO para que el formato lo muestre entre
      // paréntesis y, sobre todo, para que sumar la columna entera dé el total
      // real: lo anulado se cancela solo.
      esAnulado ? -monto : monto,
    ]

    for (let col = 1; col <= columnas.length; col += 1) {
      const celda = renglon.getCell(col)
      celda.border = BORDE_TABLA
      celda.font = {
        name: FUENTE_EXCEL,
        size: 9,
        color: esAnulado ? { argb: "FF999999" } : undefined,
      }
    }
    renglon.getCell(1).alignment = { horizontal: "center" }
    renglon.getCell(2).alignment = { horizontal: "center" }
    renglon.getCell(3).alignment = { horizontal: "center" }
    renglon.getCell(3).numFmt = "dd/mm/yyyy"
    renglon.getCell(columnas.length - 1).alignment = { horizontal: "center" }
    renglon.getCell(columnas.length).numFmt = FORMATO_MONEDA
  })

  // Total general
  const filaTotal = filaEncabezado + filas.length + 1
  const renglonTotal = hoja.getRow(filaTotal)
  hoja.mergeCells(filaTotal, 1, filaTotal, columnas.length - 1)
  const etiqueta = renglonTotal.getCell(1)
  etiqueta.value = "TOTAL Bs"
  etiqueta.font = { name: FUENTE_EXCEL, size: 9, bold: true }
  etiqueta.alignment = { horizontal: "right" }
  etiqueta.border = BORDE_TABLA

  const celdaTotal = renglonTotal.getCell(columnas.length)
  // Fórmula y no el número calculado: si alguien filtra o corrige una fila, el
  // total la sigue. Se deja el `result` para que se vea sin abrir con Excel.
  const primera = filaEncabezado + 1
  const ultima = filaEncabezado + filas.length
  celdaTotal.value =
    filas.length > 0
      ? {
          formula: `SUM(${hoja.getColumn(columnas.length).letter}${primera}:${hoja.getColumn(columnas.length).letter}${ultima})`,
          result: total - montoAnulado,
        }
      : 0
  celdaTotal.numFmt = FORMATO_MONEDA
  celdaTotal.font = { name: FUENTE_EXCEL, size: 9, bold: true }
  celdaTotal.border = BORDE_TABLA

  if (anulados > 0) {
    const nota = hoja.getRow(filaTotal + 2).getCell(1)
    nota.value = `No se suman ${anulados} ingreso${anulados === 1 ? "" : "s"} anulado${anulados === 1 ? "" : "s"} por Bs ${montoAnulado.toFixed(2)}.`
    nota.font = {
      name: FUENTE_EXCEL,
      size: 8,
      italic: true,
      color: { argb: "FF666666" },
    }
  }

  const pie = hoja.getRow(filaTotal + (anulados > 0 ? 4 : 2)).getCell(1)
  pie.value = `Emitido por ${usuario} el ${fechaCorta(emitidoEn)} · Sistema de almacenes INIAF`
  pie.font = { name: FUENTE_EXCEL, size: 8, color: { argb: "FF777777" } }

  // Lo que hace que el Excel sea un Excel y no una foto del PDF.
  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: filaEncabezado, column: 1 },
      to: { row: filaEncabezado + filas.length, column: columnas.length },
    }
  }
  hoja.views = [
    { state: "frozen", ySplit: filaEncabezado, showGridLines: false },
  ]
  prepararImpresion(hoja, filaEncabezado)

  return workbook
}

export async function descargarReporteIngresosExcel(
  datos: DatosReporteIngresos
) {
  const workbook = await crearReporteIngresosExcel(datos)
  await descargarExcel(workbook, nombreArchivoExcelIngresos(datos))
}
