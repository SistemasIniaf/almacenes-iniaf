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
  /**
   * El documento que originó el movimiento (un ingreso **o** un egreso), con
   * `numero` y `gestion` sueltos: la columna se dibuja con `NumeroDocumento`,
   * igual que en los listados de ingresos y egresos, y ese componente necesita
   * los dos campos para poder esconder la gestión en curso.
   *
   * El REPORTE del kardex recibe lo mismo pero ya formateado (`documento:
   * string`), porque en el papel el número va entero — ver `formatearNumero` en
   * `kardex.service.ts`.
   */
  documento: { numero: number; gestion: number } | null
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
  /**
   * Rango de fechas (`YYYY-MM-DD`), ambos extremos inclusivos. Con rango, el
   * saldo de apertura pasa a ser el de `desde`: un extracto de marzo abre con
   * el saldo al 1/3, no con el de enero.
   */
  desde?: string
  hasta?: string
}

/** Igual que `QueryKardex`, pero el ítem es OPCIONAL: el reporte sale de todos. */
export interface QueryReporteKardex {
  itemId?: number
  almacenId?: number
  gestion?: number
  fuenteFinanciamientoId?: number
  desde?: string
  hasta?: string
}

/** Un renglón del reporte: además de la cantidad, lleva el valor en Bs. */
export interface RenglonReporteKardex {
  id: number
  fecha: string
  tipo: TipoMovimiento
  /**
   * `I` si viene de un ingreso y `E` de un egreso —como el reporte anterior—
   * más `R` para la REVERSIÓN, que no existía allá. Sin ese tercer valor, la
   * reversión de un egreso se imprime como `E` con la cantidad en la columna
   * ENTRADA, y se lee como un error del reporte.
   */
  origen: "I" | "E" | "R"
  documento: string | null
  /**
   * Proveedor en una entrada; unidad / solicitante en una salida. La reversión
   * antepone «REVERSIÓN ·» y agrega su motivo entre paréntesis: es lo único que
   * explica por qué el renglón existe.
   */
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
  /**
   * Los criterios con los que se sacó, ya resueltos a NOMBRE (no ids). El
   * reporte los imprime: una hoja archivada sin ellos no se puede reproducir ni
   * auditar. `null` en cada uno significa «sin filtrar».
   */
  filtros: {
    desde: string | null
    hasta: string | null
    fuente: RefNombre | null
    item: { id: number; codigo: string; descripcion: string } | null
  }
  bloques: BloqueReporteKardex[]
}
