import type { PaginationQuery } from "@/lib/types"

export interface Almacen {
  id: number
  nombre: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

/** Espejo de `QueryAlmacenesDto`: `q` busca solo en nombre. */
export interface QueryAlmacenes extends PaginationQuery {
  activo?: boolean
}

export interface CreateAlmacenPayload {
  nombre: string
  activo?: boolean
}

export type UpdateAlmacenPayload = Partial<CreateAlmacenPayload>
