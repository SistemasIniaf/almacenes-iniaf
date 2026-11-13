import type { CellValue, Workbook, Worksheet } from "exceljs"

import { cargarExcelJs } from "@/lib/excel"
import type {
  FilaSaldo,
  FilaSaldoPayload,
} from "@/features/saldos-iniciales/saldos-iniciales.types"

/**
 * Lee la planilla que arma `tools/migracion-saldos/extrae-saldos.js` y la
 * convierte en las filas que espera el backend, con la correspondencia ya
 * resuelta: cada lote toma el almacén, la fuente y el código nuevos de las
 * hojas ALMACENES, FUENTES e ÍTEMS — no de las columnas «→» de LOTES, que son
 * fórmulas y solo tienen valor si Excel guardó el archivo después de abrirlo.
 *
 * Las columnas se buscan por su TÍTULO, no por posición: si alguien inserta
 * una columna para anotar algo, la lectura sigue funcionando.
 */

/** El valor «visible» de una celda, sea número, texto, fórmula o texto rico. */
function valor(v: CellValue): string | number | null {
  if (v == null) return null
  if (typeof v === "number" || typeof v === "string") return v
  if (typeof v === "boolean") return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object") {
    if ("result" in v) return valor(v.result as CellValue)
    if ("richText" in v) return v.richText.map((t) => t.text).join("")
    if ("text" in v) return String(v.text)
  }
  return null
}

const texto = (v: CellValue): string | undefined => {
  const x = valor(v)
  const s = x == null ? "" : String(x).trim()
  return s === "" ? undefined : s
}

const numero = (v: CellValue): number | null => {
  const x = valor(v)
  if (x == null || x === "") return null
  const n = typeof x === "number" ? x : Number(String(x).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

const redondear = (n: number, decimales: number) =>
  Math.round(n * 10 ** decimales) / 10 ** decimales

const normalizarTitulo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()

/** Índice de columna (1-based) de cada título de la fila 1. */
function columnas(hoja: Worksheet): Map<string, number> {
  const mapa = new Map<string, number>()
  hoja.getRow(1).eachCell((celda, col) => {
    const t = texto(celda.value)
    if (t) mapa.set(normalizarTitulo(t), col)
  })
  return mapa
}

function hojaObligatoria(libro: Workbook, nombre: string): Worksheet {
  const hoja = libro.getWorksheet(nombre)
  if (!hoja) {
    throw new Error(
      `La planilla no tiene la hoja «${nombre}». ¿Es la que genera la herramienta de migración?`
    )
  }
  return hoja
}

function columna(cols: Map<string, number>, hoja: string, titulo: string) {
  const c = cols.get(normalizarTitulo(titulo))
  if (!c) throw new Error(`Falta la columna «${titulo}» en la hoja ${hoja}.`)
  return c
}

/** Hoja de correspondencia → id viejo ⇒ valor nuevo (las celdas vacías no entran). */
function correspondencia(libro: Workbook, nombre: string, tituloNuevo: string) {
  const hoja = hojaObligatoria(libro, nombre)
  const cols = columnas(hoja)
  const cId = columna(cols, nombre, "Id viejo")
  const cNuevo = columna(cols, nombre, tituloNuevo)
  const mapa = new Map<number, string>()
  hoja.eachRow((fila, n) => {
    if (n === 1) return
    const id = numero(fila.getCell(cId).value)
    const nuevo = texto(fila.getCell(cNuevo).value)
    if (id != null && nuevo) mapa.set(id, nuevo)
  })
  return mapa
}

export async function leerPlanilla(archivo: File): Promise<FilaSaldo[]> {
  const ExcelJS = await cargarExcelJs()
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(await archivo.arrayBuffer())

  const almacenes = correspondencia(libro, "ALMACENES", "ALMACÉN NUEVO")
  const fuentes = correspondencia(libro, "FUENTES", "FUENTE NUEVA")
  const items = correspondencia(libro, "ÍTEMS", "CÓDIGO ÍTEM NUEVO")

  const hoja = hojaObligatoria(libro, "LOTES")
  const cols = columnas(hoja)
  const c = (titulo: string) => columna(cols, "LOTES", titulo)
  const C = {
    lote: c("Id lote viejo"),
    ingreso: c("Id ingreso viejo"),
    almacenId: c("Id almacén"),
    almacen: c("Almacén"),
    numero: c("Nº ingreso"),
    fecha: c("Fecha ingreso"),
    itemId: c("Id ítem"),
    descripcion: c("Descripción"),
    observacion: c("Observación de la línea"),
    fondoId: c("Id fuente"),
    proveedor: c("Proveedor"),
    nit: c("NIT"),
    factura: c("Factura"),
    proceso: c("Proceso / C31"),
    certificacion: c("Certificación"),
    notaRemision: c("Nota remisión"),
    saldo: c("SALDO"),
    precio: c("Precio unit."),
  }

  const filas: FilaSaldo[] = []
  hoja.eachRow((fila, n) => {
    if (n === 1) return
    const celda = (col: number) => fila.getCell(col).value
    const loteAnteriorId = numero(celda(C.lote))
    // La fila TOTAL del pie (y cualquier renglón agregado a mano) no tiene lote.
    if (loteAnteriorId == null) return
    const almacenId = numero(celda(C.almacenId))
    const fondoId = numero(celda(C.fondoId))
    const itemId = numero(celda(C.itemId))
    filas.push({
      loteAnteriorId,
      ingresoAnteriorId: numero(celda(C.ingreso)) ?? 0,
      almacen: almacenId != null ? almacenes.get(almacenId) : undefined,
      fuente: fondoId != null ? fuentes.get(fondoId) : undefined,
      itemCodigo: itemId != null ? items.get(itemId) : undefined,
      cantidad: redondear(numero(celda(C.saldo)) ?? 0, 2),
      precioUnitario: redondear(numero(celda(C.precio)) ?? 0, 5),
      observacion: texto(celda(C.observacion)),
      numeroAnterior: texto(celda(C.numero)),
      fechaAnterior: texto(celda(C.fecha)),
      almacenAnterior: texto(celda(C.almacen)),
      proveedor: texto(celda(C.proveedor)),
      nit: texto(celda(C.nit)),
      factura: texto(celda(C.factura)),
      procesoC31: texto(celda(C.proceso)),
      certificacion: texto(celda(C.certificacion)),
      notaRemision: texto(celda(C.notaRemision)),
      descripcionAnterior: texto(celda(C.descripcion)),
    })
  })
  if (filas.length === 0) throw new Error("La hoja LOTES no tiene lotes.")
  return filas
}

/** Lo que viaja a la API: sin los campos que son solo de la pantalla. */
export const aPayload = (filas: FilaSaldo[]): FilaSaldoPayload[] =>
  filas.map((f) => {
    const { descripcionAnterior, ...resto } = f
    void descripcionAnterior
    return resto
  })
