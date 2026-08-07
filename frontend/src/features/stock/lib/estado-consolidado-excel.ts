import {
  cargarExcelJs,
  crearTabla,
  datosCabeceraExcel,
  descargarExcel,
  FORMATO_MONEDA,
  membreteExcel,
  prepararImpresion,
} from "@/lib/excel"
import { esNacional, fechaCorta } from "@/lib/reporte-comun"

import type { DatosReporteStock } from "@/features/stock/lib/estado-almacenes-pdf"
import type { FilaReporteStock } from "@/features/stock/stock.types"

/**
 * «Estado de almacenes consolidado por PARTIDA» en Excel: el RESUMEN contable,
 * sin ítems — cuánta plata hay por partida y dentro por fuente.
 *
 * Es una reagrupación del MISMO dato que el reporte por ítem, así que los dos
 * tienen que cuadrar. Por eso la agrupación se hace acá igual que en el PDF y
 * no se toca el criterio.
 *
 * Sin filtrar almacén el título lleva «— NACIONAL» y se omite la línea de
 * OFICINA, igual que en el papel.
 */

interface GrupoConsolidado {
  partida: FilaReporteStock["item"]["partida"]
  fuente: string
  valor: number
}

/** Suma por partida + fuente y ordena por partida y, dentro, por fuente. */
function agrupar(filas: FilaReporteStock[]): GrupoConsolidado[] {
  const grupos = new Map<string, GrupoConsolidado>()

  for (const fila of filas) {
    const fuente = fila.fuente?.nombre ?? "SIN FUENTE"
    const clave = `${fila.item.partida.id}|${fuente}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.valor += fila.valor
    else
      grupos.set(clave, {
        partida: fila.item.partida,
        fuente,
        valor: fila.valor,
      })
  }

  return [...grupos.values()].sort(
    (a, b) =>
      a.partida.codigo.localeCompare(b.partida.codigo) ||
      a.fuente.localeCompare(b.fuente)
  )
}

export function nombreArchivoExcelConsolidado(
  datos: DatosReporteStock
): string {
  return `estado-almacenes-por-partida-${datos.emitidoEn.toISOString().slice(0, 10)}.xlsx`
}

export async function crearEstadoConsolidadoExcel(datos: DatosReporteStock) {
  const ExcelJS = await cargarExcelJs()
  const { filas, almacen, emitidoEn, usuario } = datos
  const grupos = agrupar(filas)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = emitidoEn

  const hoja = workbook.addWorksheet("Por partida", {
    views: [{ showGridLines: false }],
  })

  const columnas = [
    { header: "Nro", width: 6, align: "center" as const },
    { header: "DESCRIPCIÓN", width: 56 },
    { header: "PARTIDA", width: 12, align: "center" as const },
    { header: "FUENTE FIN.", width: 28 },
    {
      header: "VALOR",
      width: 16,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
  ]
  hoja.columns = columnas.map((c) => ({ width: c.width }))

  const filaDatos = await membreteExcel(workbook, hoja, {
    titulo: esNacional(almacen)
      ? "ESTADO DE ALMACENES CONSOLIDADO POR PARTIDA — NACIONAL"
      : "ESTADO DE ALMACENES CONSOLIDADO POR PARTIDA",
    leyenda: `AL: ${fechaCorta(emitidoEn)}`,
    anchos: columnas.map((c) => c.width),
  })

  // Sin almacén filtrado no va la línea de OFICINA: el título ya dice NACIONAL.
  const filaEncabezado = datosCabeceraExcel(hoja, filaDatos, [
    ...(esNacional(almacen) ? [] : [{ rotulo: "OFICINA:", valor: almacen! }]),
    { rotulo: "GESTIÓN:", valor: emitidoEn.getFullYear() },
  ])

  const tabla = crearTabla(hoja, columnas, filaEncabezado)

  // Subtotales y total como FÓRMULAS: ver el comentario del reporte por ítem.
  const letra = hoja.getColumn(columnas.length).letter
  const filasSubtotal: number[] = []
  let desdeGrupo = filaEncabezado + 1

  const cerrarPartida = (monto: number) => {
    tabla.resumen("Subtotal:", monto, {
      formula: `SUM(${letra}${desdeGrupo}:${letra}${tabla.ultimaFila})`,
    })
    filasSubtotal.push(tabla.ultimaFila)
    desdeGrupo = tabla.ultimaFila + 1
  }

  let partidaActual: string | null = null
  let acumuladoPartida = 0
  let total = 0
  let numero = 0

  for (const grupo of grupos) {
    if (partidaActual !== null && grupo.partida.codigo !== partidaActual) {
      cerrarPartida(acumuladoPartida)
      acumuladoPartida = 0
    }
    partidaActual = grupo.partida.codigo

    numero += 1
    tabla.fila([
      numero,
      grupo.partida.denominacion,
      grupo.partida.codigo,
      grupo.fuente,
      grupo.valor,
    ])

    acumuladoPartida += grupo.valor
    total += grupo.valor
  }

  if (partidaActual !== null) {
    cerrarPartida(acumuladoPartida)
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

export async function descargarEstadoConsolidadoExcel(
  datos: DatosReporteStock
) {
  const workbook = await crearEstadoConsolidadoExcel(datos)
  await descargarExcel(workbook, nombreArchivoExcelConsolidado(datos))
}
