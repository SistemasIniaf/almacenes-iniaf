import {
  BORDE_TABLA,
  cargarExcelJs,
  crearTabla,
  descargarExcel,
  FORMATO_CANTIDAD,
  FORMATO_FECHA,
  FORMATO_MONEDA,
  FORMATO_PRECIO,
  FUENTE_EXCEL,
  membreteExcel,
  prepararImpresion,
} from "@/lib/excel"
import { fechaCorta } from "@/lib/reporte-comun"

import type { DatosReporteKardex } from "@/features/kardex/lib/reporte-kardex-pdf"
import type { BloqueReporteKardex } from "@/features/kardex/kardex.types"

/**
 * El reporte de kardex en Excel: un BLOQUE por ítem + fuente, con su saldo de
 * apertura, sus movimientos y sus totales.
 *
 * Dos cosas propias de este reporte:
 *
 * - **Cada bloque arranca en hoja nueva al imprimir**, igual que el PDF: así se
 *   puede separar el archivo por ítem, como se guardaba en papel. En Excel eso
 *   son saltos de página manuales (`rowBreaks`), no hojas distintas — un libro
 *   con cien pestañas sería peor que uno con cien páginas.
 * - **No lleva autofiltro ni panel congelado.** Con bloques encadenados no hay
 *   una única fila de encabezados que congelar, y filtrar rompería los saldos
 *   corrientes, que solo tienen sentido en orden.
 */

const fechaIso = (iso: string) => {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number)
  return new Date(anio, mes - 1, dia)
}

export function nombreArchivoExcelKardex(datos: DatosReporteKardex): string {
  return `kardex-${datos.reporte.gestion}-${datos.emitidoEn.toISOString().slice(0, 10)}.xlsx`
}

export async function crearReporteKardexExcel(datos: DatosReporteKardex) {
  const ExcelJS = await cargarExcelJs()
  const { almacen, emitidoEn, usuario, reporte } = datos
  const { bloques, gestion } = reporte

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de almacenes INIAF"
  workbook.created = emitidoEn

  const hoja = workbook.addWorksheet(`Kardex ${gestion}`, {
    views: [{ showGridLines: false }],
  })

  const columnas = [
    {
      header: "FECHA",
      width: 12,
      align: "center" as const,
      formato: FORMATO_FECHA,
    },
    { header: "DOC.", width: 12, align: "center" as const },
    { header: "T", width: 5, align: "center" as const },
    { header: "DETALLE", width: 40 },
    {
      header: "ENTRADA",
      width: 11,
      align: "right" as const,
      formato: FORMATO_CANTIDAD,
    },
    {
      header: "SALIDA",
      width: 11,
      align: "right" as const,
      formato: FORMATO_CANTIDAD,
    },
    {
      header: "SALDO",
      width: 11,
      align: "right" as const,
      formato: FORMATO_CANTIDAD,
    },
    {
      header: "P/U",
      width: 11,
      align: "right" as const,
      formato: FORMATO_PRECIO,
    },
    {
      header: "INGRESO",
      width: 13,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
    {
      header: "EGRESO",
      width: 13,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
    {
      header: "SALDO Bs",
      width: 14,
      align: "right" as const,
      formato: FORMATO_MONEDA,
    },
  ]
  hoja.columns = columnas.map((c) => ({ width: c.width }))

  let fila = await membreteExcel(workbook, hoja, {
    titulo: "KARDEX DE ALMACENES",
    leyenda: `GESTIÓN ${gestion} · AL: ${fechaCorta(emitidoEn)}`,
    anchos: columnas.map((c) => c.width),
  })

  const oficina = hoja.getCell(fila, 1)
  oficina.value = `OFICINA: ${almacen ?? "NACIONAL (todos los almacenes)"}`
  oficina.font = { name: FUENTE_EXCEL, size: 9, bold: true }
  fila += 2

  /** La ficha que identifica al bloque, sobre su tabla. */
  const cabeceraBloque = (bloque: BloqueReporteKardex) => {
    const datosBloque = [
      ["CÓDIGO:", bloque.item.codigo],
      ["ÍTEM:", bloque.item.descripcion],
      ["PARTIDA:", bloque.item.partida.codigo],
      ["UNIDAD:", bloque.item.unidadMedida],
      ["FUENTE:", bloque.fuente?.nombre ?? "SIN FUENTE"],
    ]
    for (const [rotulo, valor] of datosBloque) {
      const celdaRotulo = hoja.getCell(fila, 1)
      celdaRotulo.value = rotulo
      celdaRotulo.font = { name: FUENTE_EXCEL, size: 9, bold: true }
      hoja.mergeCells(fila, 2, fila, 4)
      const celdaValor = hoja.getCell(fila, 2)
      celdaValor.value = valor
      celdaValor.font = { name: FUENTE_EXCEL, size: 9 }
      fila += 1
    }
    fila += 1
  }

  const cursivaGris = {
    name: FUENTE_EXCEL,
    size: 9,
    italic: true,
    color: { argb: "FF666666" },
  }

  const saltos: number[] = []

  bloques.forEach((bloque: BloqueReporteKardex, indice: number) => {
    // Salto de página ANTES de cada bloque menos el primero: al imprimir, cada
    // ítem empieza en su hoja.
    if (indice > 0) saltos.push(fila - 1)

    cabeceraBloque(bloque)

    const tabla = crearTabla(hoja, columnas, fila)

    // Sin esta línea el saldo de la primera fila parece salir de la nada.
    const apertura = tabla.fila([
      null,
      null,
      null,
      `Saldo al cierre de ${gestion - 1}`,
      null,
      null,
      Number(bloque.saldoInicial),
      null,
      null,
      null,
      Number(bloque.valorInicial),
    ])
    for (let col = 1; col <= columnas.length; col += 1) {
      apertura.getCell(col).font = cursivaGris
    }

    for (const m of bloque.movimientos) {
      // La reversión se marca: deshace un movimiento anterior, así que su
      // cantidad cae en la columna contraria a la que uno esperaría por el tipo
      // de documento. Sin la marca, un renglón «E» con la cantidad en ENTRADA se
      // lee como un error del reporte.
      const esReversion = m.origen === "R"
      const renglon = tabla.fila([
        fechaIso(m.fecha),
        m.documento ?? "—",
        m.origen,
        m.detalle,
        m.entrada ? Number(m.entrada) : null,
        m.salida ? Number(m.salida) : null,
        Number(m.saldo),
        Number(m.precioUnitario),
        m.valorEntrada ? Number(m.valorEntrada) : null,
        m.valorSalida ? Number(m.valorSalida) : null,
        Number(m.valorSaldo),
      ])
      if (esReversion) {
        for (let col = 1; col <= columnas.length; col += 1) {
          renglon.getCell(col).font = {
            name: FUENTE_EXCEL,
            size: 9,
            italic: true,
            color: { argb: "FF8A4B00" },
          }
        }
      }
    }

    const { totales } = bloque
    tabla.resumen("Totales del período (valor):", Number(totales.valorSaldo), {
      destacado: true,
    })

    fila = tabla.ultimaFila + 3
  })

  if (bloques.length === 0) {
    const vacio = hoja.getCell(fila, 1)
    vacio.value = "Sin movimientos para los filtros elegidos."
    vacio.font = cursivaGris
    fila += 2
  }

  const pie = hoja.getCell(fila, 1)
  pie.value = `Emitido por ${usuario} el ${fechaCorta(emitidoEn)} · Sistema de almacenes INIAF`
  pie.font = { name: FUENTE_EXCEL, size: 8, color: { argb: "FF777777" } }

  prepararImpresion(hoja, 0)
  // `printTitlesRow` no aplica: cada bloque tiene su propio encabezado.
  delete hoja.pageSetup.printTitlesRow

  // Los saltos de página manuales no están en los tipos de exceljs pero sí en
  // su implementación (se escriben como `<brk>` en el XML de la hoja): es lo
  // que hace que cada bloque arranque en hoja nueva al imprimir, como el PDF.
  if (saltos.length > 0) {
    ;(hoja as unknown as { rowBreaks: { id: number }[] }).rowBreaks =
      saltos.map((numeroFila) => ({ id: numeroFila }))
  }

  return workbook
}

export async function descargarReporteKardexExcel(datos: DatosReporteKardex) {
  const workbook = await crearReporteKardexExcel(datos)
  await descargarExcel(workbook, nombreArchivoExcelKardex(datos))
}

/** Se re-exporta para que el borde de tabla quede accesible al maquetar. */
export { BORDE_TABLA }
