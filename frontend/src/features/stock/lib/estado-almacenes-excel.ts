import {
  cargarExcelJs,
  crearTabla,
  datosCabeceraExcel,
  descargarExcel,
  FORMATO_CANTIDAD,
  FORMATO_MONEDA,
  FORMATO_PRECIO,
  membreteExcel,
  prepararImpresion,
} from "@/lib/excel"
import { fechaCorta } from "@/lib/reporte-comun"

import type { DatosReporteStock } from "@/features/stock/lib/estado-almacenes-pdf"
import type { FilaReporteStock } from "@/features/stock/stock.types"

/**
 * «Estado de almacenes consolidado por ÍTEM» en Excel: el DETALLE, agrupado por
 * partida, con la fuente como columna.
 *
 * Las filas van PLANAS, igual que en el PDF (decisión del usuario): la partida
 * abre una fila de encabezado sombreada y cierra con su subtotal, en vez de
 * usar el agrupador plegable de Excel. Así el papel y la planilla se leen igual.
 *
 * Ojo con el AUTOFILTRO: acá **no se pone**, a diferencia de los registros. Con
 * filas de grupo y de subtotal intercaladas, filtrar deja subtotales sueltos que
 * ya no corresponden a lo que se ve — un reporte que miente. Quien quiera
 * analizar tiene la pantalla de stock y sus filtros propios.
 */

const descripcion = (fila: FilaReporteStock) =>
  fila.observacion
    ? `${fila.item.descripcion} (${fila.observacion})`
    : fila.item.descripcion

export function nombreArchivoExcelEstadoAlmacenes(
  datos: DatosReporteStock
): string {
  return `estado-almacenes-por-item-${datos.emitidoEn.toISOString().slice(0, 10)}.xlsx`
}

export async function crearEstadoAlmacenesExcel(datos: DatosReporteStock) {
  const ExcelJS = await cargarExcelJs()
  const { filas, almacen, emitidoEn, usuario } = datos

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = emitidoEn

  const hoja = workbook.addWorksheet("Por ítem", {
    views: [{ showGridLines: false }],
  })

  const columnas = [
    { header: "CÓDIGO", width: 16 },
    { header: "DETALLE", width: 52 },
    { header: "FUENTE FIN.", width: 24 },
    { header: "UNIDAD", width: 12, align: "center" as const },
    {
      header: "CANTIDAD",
      width: 12,
      align: "right" as const,
      formato: FORMATO_CANTIDAD,
    },
    {
      header: "P/U",
      width: 12,
      align: "right" as const,
      formato: FORMATO_PRECIO,
    },
    {
      header: "VALOR",
      width: 15,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
  ]
  hoja.columns = columnas.map((c) => ({ width: c.width }))

  const filaDatos = await membreteExcel(workbook, hoja, {
    titulo: "ESTADO DE ALMACENES CONSOLIDADO POR ÍTEM",
    leyenda: `AL: ${fechaCorta(emitidoEn)}`,
    anchos: columnas.map((c) => c.width),
  })

  const filaEncabezado = datosCabeceraExcel(hoja, filaDatos, [
    { rotulo: "OFICINA:", valor: almacen ?? "NACIONAL (todos los almacenes)" },
    { rotulo: "GESTIÓN:", valor: emitidoEn.getFullYear() },
  ])

  const tabla = crearTabla(hoja, columnas, filaEncabezado)

  // Un solo recorrido, abriendo un encabezado cada vez que cambia la partida.
  // Las filas ya vienen ordenadas por partida → ítem → fuente desde el backend.
  //
  // Los subtotales y el total van como FÓRMULAS, no como números calculados: si
  // alguien corrige una cantidad o un precio en la planilla, todo lo demás se
  // acomoda. El total suma las CELDAS DE SUBTOTAL y no el rango entero — si
  // sumara el rango contaría dos veces, porque los subtotales están adentro.
  const letra = hoja.getColumn(columnas.length).letter
  const filasSubtotal: number[] = []
  let desdeGrupo = 0

  const cerrarPartida = (monto: number) => {
    tabla.resumen("Subtotal partida:", monto, {
      formula: `SUM(${letra}${desdeGrupo}:${letra}${tabla.ultimaFila})`,
    })
    filasSubtotal.push(tabla.ultimaFila)
  }

  let partidaActual: string | null = null
  let totalPartida = 0
  let total = 0

  for (const fila of filas) {
    const partida = `${fila.item.partida.codigo} · ${fila.item.partida.denominacion}`
    if (partida !== partidaActual) {
      if (partidaActual !== null) cerrarPartida(totalPartida)
      tabla.grupo(partida.toUpperCase())
      desdeGrupo = tabla.ultimaFila + 1
      partidaActual = partida
      totalPartida = 0
    }

    tabla.fila([
      fila.item.codigo,
      descripcion(fila),
      fila.fuente?.nombre ?? "SIN FUENTE",
      fila.item.unidadMedida,
      Number(fila.cantidad),
      Number(fila.precioUnitario),
      Number(fila.valor),
    ])

    totalPartida += fila.valor
    total += fila.valor
  }

  if (partidaActual !== null) {
    cerrarPartida(totalPartida)
    tabla.resumen("TOTAL GENERAL Bs", total, {
      destacado: true,
      formula: `SUM(${filasSubtotal.map((f) => `${letra}${f}`).join(",")})`,
    })
  } else {
    tabla.nota("Sin existencias para los filtros elegidos.")
  }

  tabla.nota(
    `Emitido por ${usuario} el ${fechaCorta(emitidoEn)} · Sistema de almacenes INIAF`
  )

  hoja.views = [
    { state: "frozen", ySplit: filaEncabezado, showGridLines: false },
  ]
  prepararImpresion(hoja, filaEncabezado)

  return workbook
}

export async function descargarEstadoAlmacenesExcel(datos: DatosReporteStock) {
  const workbook = await crearEstadoAlmacenesExcel(datos)
  await descargarExcel(workbook, nombreArchivoExcelEstadoAlmacenes(datos))
}
