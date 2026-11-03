import {
  cargarExcelJs,
  crearTabla,
  datosCabeceraExcel,
  descargarExcel,
  FORMATO_ANULADO,
  FORMATO_FECHA,
  FORMATO_MONEDA,
  membreteExcel,
  prepararImpresion,
} from "@/lib/excel"
import { esNacional, fechaCorta, numeroDocumento } from "@/lib/reporte-comun"
import { ESTADO_LABEL } from "@/features/egresos/egresos.types"
import { leyendaPeriodo } from "@/features/ingresos/lib/reporte-ingresos-pdf"

import type { DatosReporteEgresos } from "@/features/egresos/lib/reporte-egresos-pdf"

/**
 * El «Registro de egresos» del PDF, en Excel. Ver `lib/excel.ts` para lo que
 * cambia entre los dos formatos (números de verdad, autofiltro, panel congelado).
 *
 * Los ANULADOS van con su importe POSITIVO y entre paréntesis por formato
 * (`FORMATO_ANULADO`), igual que en el de ingresos, y el total los deja afuera
 * con un SUMIF sobre la columna Estado. Se guardaban en negativo, y entonces la
 * suma los RESTABA de los entregados en vez de ignorarlos.
 */

const fechaIso = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number)
  return new Date(anio, mes - 1, dia)
}

export function nombreArchivoExcelEgresos(datos: DatosReporteEgresos): string {
  const periodo = datos.desde ?? datos.emitidoEn.toISOString().slice(0, 10)
  return `registro-egresos-${periodo}.xlsx`
}

export async function crearReporteEgresosExcel(datos: DatosReporteEgresos) {
  const ExcelJS = await cargarExcelJs()
  const { filas, almacen, emitidoEn, usuario, desde, hasta } = datos

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = emitidoEn

  const hoja = workbook.addWorksheet("Registro de egresos", {
    views: [{ showGridLines: false }],
  })

  const conAlmacen = esNacional(almacen)
  const columnas = [
    { header: "Nro", width: 6, align: "center" as const },
    { header: "Nº PEDIDO", width: 12, align: "center" as const },
    {
      header: "FECHA",
      width: 12,
      align: "center" as const,
      formato: FORMATO_FECHA,
    },
    ...(conAlmacen ? [{ header: "ALMACÉN", width: 24 }] : []),
    { header: "UNIDAD", width: 12, align: "center" as const },
    { header: "SOLICITANTE", width: 30 },
    { header: "JUSTIFICACIÓN", width: 48 },
    { header: "ESTADO", width: 20, align: "center" as const },
    {
      header: "TOTAL Bs",
      width: 15,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
  ]
  hoja.columns = columnas.map((c) => ({ width: c.width }))

  const filaDatos = await membreteExcel(workbook, hoja, {
    titulo: "REGISTRO DE EGRESOS DE ALMACÉN",
    leyenda: leyendaPeriodo(desde, hasta) ?? `AL: ${fechaCorta(emitidoEn)}`,
    anchos: columnas.map((c) => c.width),
  })

  const filaEncabezado = datosCabeceraExcel(hoja, filaDatos, [
    { rotulo: "OFICINA:", valor: almacen ?? "NACIONAL (todos los almacenes)" },
    { rotulo: "GESTIÓN:", valor: emitidoEn.getFullYear() },
  ])

  const tabla = crearTabla(hoja, columnas, filaEncabezado)

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

    tabla.fila(
      [
        indice + 1,
        fila.numero != null ? numeroDocumento(fila) : "s/n",
        fechaIso(fila.fechaEnvio ?? fila.createdAt),
        ...(conAlmacen ? [fila.almacen.nombre] : []),
        fila.unidad.sigla,
        fila.solicitante.nombre,
        fila.justificacion,
        ESTADO_LABEL[fila.estado],
        monto,
      ],
      { gris: esAnulado }
    )
    if (esAnulado) {
      hoja.getRow(filaEncabezado + 1 + indice).getCell(columnas.length).numFmt =
        FORMATO_ANULADO
    }
  })

  if (filas.length > 0) {
    const primera = filaEncabezado + 1
    const ultima = filaEncabezado + filas.length
    const importes = hoja.getColumn(columnas.length).letter
    const estados = hoja.getColumn(columnas.length - 1).letter
    tabla.resumen("TOTAL GENERAL Bs", total, {
      destacado: true,
      formula: `SUMIF(${estados}${primera}:${estados}${ultima},"<>${ESTADO_LABEL.ANULADO}",${importes}${primera}:${importes}${ultima})`,
    })
  }

  if (anulados > 0) {
    tabla.nota(
      `No se suman ${anulados} pedido${anulados === 1 ? "" : "s"} anulado${anulados === 1 ? "" : "s"} por Bs ${montoAnulado.toFixed(2)}.`
    )
  }
  // La misma advertencia que el PDF: sin esto el total se lee como plata que
  // salió del almacén, y una parte todavía está en la estantería.
  tabla.nota(
    "Los pedidos que no están entregados se valorizan por la cantidad solicitada: todavía no movieron stock."
  )
  tabla.nota(
    `Emitido por ${usuario} el ${fechaCorta(emitidoEn)} · Sistema de almacenes INIAF`
  )

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

export async function descargarReporteEgresosExcel(datos: DatosReporteEgresos) {
  const workbook = await crearReporteEgresosExcel(datos)
  await descargarExcel(workbook, nombreArchivoExcelEgresos(datos))
}
