import type { PaginationQuery } from "@/lib/types"

interface RefNombre {
  id: number
  nombre: string
}

/**
 * Un LOTE con saldo: una línea de ingreso que todavía tiene material.
 *
 * El almacén y la fuente no son del lote, son del ingreso que lo trajo — por eso
 * cuelgan de ahí. Los decimales llegan como string (Prisma Decimal).
 */
export interface LoteStock {
  id: number
  cantidad: string
  precioUnitario: string
  saldoCantidad: string
  observacion: string | null
  ingreso: {
    id: number
    numero: number | null
    gestion: number | null
    fechaRemision: string | null
    almacen: RefNombre
    fuenteFinanciamiento: RefNombre | null
    proveedor: RefNombre | null
  }
}

/** Partida del clasificador a la que pertenece el ítem. */
export interface PartidaStock {
  id: number
  codigo: string
  denominacion: string
}

/** Un ítem con existencias: el saldo total y de qué lotes sale. */
export interface ItemStock {
  id: number
  codigo: string
  descripcion: string
  unidadMedida: string
  partida: PartidaStock
  /** Suma de los saldos de sus lotes. */
  saldoTotal: string
  lotes: LoteStock[]
}

export interface QueryStock extends PaginationQuery {
  almacenId?: number
  fuenteFinanciamientoId?: number
  itemId?: number
  partidaId?: number
  /** Por defecto el backend devuelve solo lo que tiene saldo. */
  conSaldo?: boolean
}
