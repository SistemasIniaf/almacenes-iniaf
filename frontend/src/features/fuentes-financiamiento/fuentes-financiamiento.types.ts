import type { PaginationQuery } from "@/lib/types"

export interface FuenteFinanciamiento {
  id: number
  /** Único. Ej. «Banco Mundial», «TGN Programa Trigo». */
  nombre: string
  /** Opcional, por si el área financiera maneja un código propio. */
  codigo: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
}

/** Espejo de `QueryFuentesFinanciamientoDto`: `q` busca en nombre y código. */
export interface QueryFuentesFinanciamiento extends PaginationQuery {
  activo?: boolean
}

export interface CreateFuenteFinanciamientoPayload {
  nombre: string
  codigo?: string
  activo?: boolean
}

/**
 * En update el código SÍ admite cadena vacía: es la forma de limpiarlo (el
 * service la normaliza a null). En create, en cambio, hay que omitirlo vacío.
 */
export interface UpdateFuenteFinanciamientoPayload {
  nombre?: string
  codigo?: string
  activo?: boolean
}
