/**
 * Espejo de `ImportarSaldosDto` / `FilaSaldoDto` del backend. La fila ya viene
 * con la correspondencia resuelta (almacén, fuente e ítem NUEVOS) a partir de
 * las hojas de la planilla de migración.
 */
export interface FilaSaldo {
  loteAnteriorId: number
  ingresoAnteriorId: number
  almacen?: string
  fuente?: string
  itemCodigo?: string
  cantidad: number
  precioUnitario: number
  observacion?: string
  numeroAnterior?: string
  fechaAnterior?: string
  almacenAnterior?: string
  proveedor?: string
  nit?: string
  factura?: string
  procesoC31?: string
  certificacion?: string
  notaRemision?: string
  /** Solo para la pantalla (no viaja): lo que se muestra en la lista de errores. */
  descripcionAnterior?: string
}

export type FilaSaldoPayload = Omit<FilaSaldo, "descripcionAnterior">

export interface ImportarSaldosPayload {
  /** `YYYY-MM-DD`: los saldos son al cierre de ese día. */
  fechaCorte: string
  filas: FilaSaldoPayload[]
}

export type EstadoFila = "error" | "importado"

export interface ResultadoValidacion {
  errorFecha: string | null
  /** Solo las filas que NO están bien; `indice` es la posición en `filas`. */
  filas: { indice: number; estado: EstadoFila; mensajes: string[] }[]
  almacenes: {
    almacenId: number | null
    almacen: string
    lotes: number
    valor: number
    errores: number
    importados: number
  }[]
}

export interface ResultadoImportacion {
  documentos: number
  lotes: number
  gestion: number
}
