import type { PaginationQuery } from "@/lib/types"

export interface Unidad {
  id: number
  nombre: string
  sigla: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

/** Espejo de `QueryUnidadesDto`: `q` busca en nombre y sigla. */
export interface QueryUnidades extends PaginationQuery {
  activo?: boolean
}

export interface CreateUnidadPayload {
  nombre: string
  sigla: string
  activo?: boolean
}

export type UpdateUnidadPayload = Partial<CreateUnidadPayload>
