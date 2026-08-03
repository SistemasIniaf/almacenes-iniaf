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

/** Igual que `QueryKardex`, pero el ítem es OPCIONAL: el reporte sale de todos. */
export interface QueryReporteKardex {
  itemId?: number
  almacenId?: number
  gestion?: number
  fuenteFinanciamientoId?: number
}

/** Un renglón del reporte: además de la cantidad, lleva el valor en Bs. */
export interface RenglonReporteKardex {
  id: number
  fecha: string
  tipo: TipoMovimiento
  /** `I` si viene de un ingreso, `E` de un egreso — como el reporte anterior. */
  origen: "I" | "E"
  documento: string | null
  /** Proveedor en una entrada; unidad / solicitante en una salida. */
  detalle: string
  precioUnitario: number
  entrada: number
  salida: number
  saldo: number
  valorEntrada: number
  valorSalida: number
  valorSaldo: number
}

/**
 * Un BLOQUE del reporte: el libro de un ítem con UNA fuente.
 *
 * El papel separa por fuente aunque la pantalla no lo haga: cada financiador
 * rinde su plata por separado, así que cada uno lleva su saldo y sus totales.
 */
export interface BloqueReporteKardex {
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
    partida: { id: number; codigo: string }
  }
  fuente: RefNombre | null
  saldoInicial: number
  valorInicial: number
  movimientos: RenglonReporteKardex[]
  totales: {
    entradas: number
    salidas: number
    saldo: number
    valorEntradas: number
    valorSalidas: number
    valorSaldo: number
  }
}

export interface ReporteKardex {
  almacen: RefNombre
  gestion: number
  bloques: BloqueReporteKardex[]
}
