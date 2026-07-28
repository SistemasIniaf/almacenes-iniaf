interface RefNombre {
  id: number
  nombre: string
}

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "REVERSION"

/**
 * Un renglón del libro. `entrada`/`salida` vienen ya resueltas por el backend
 * (el signo de una REVERSIÓN depende de qué documento revierte, no del tipo) y
 * `saldo` es el acumulado hasta ese movimiento.
 */
export interface MovimientoKardex {
  id: number
  fecha: string
  tipo: TipoMovimiento
  motivo: string | null
  /** Nº del documento que lo originó, ya formateado: `001/2026`. */
  documento: string | null
  ingresoId: number | null
  fuente: RefNombre | null
  precioUnitario: string
  entrada: number | null
  salida: number | null
  saldo: number
}

export interface Kardex {
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
    partida: { id: number; codigo: string; denominacion: string }
  }
  almacen: RefNombre
  gestion: number
  /** Lo que venía de gestiones anteriores. */
  saldoInicial: number
  saldoFinal: number
  movimientos: MovimientoKardex[]
}

export interface QueryKardex {
  itemId: number
  almacenId?: number
  gestion?: number
  fuenteFinanciamientoId?: number
}
