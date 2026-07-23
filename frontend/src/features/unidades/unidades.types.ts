import type { PaginationQuery } from "@/lib/types"

export interface Unidad {
  id: number
  nombre: string
  sigla: string
  activo: boolean
  /** Grupo (MOF, OTROS...). Lo elige la raíz; los hijos lo heredan. */
  grupo: string | null
  padreId: number | null
  padre?: Unidad
  createdAt: string
  updatedAt: string
}

/** Nodo del arbol jerarquico que devuelve `GET /unidades/arbol`. */
export interface UnidadArbol extends Unidad {
  hijos: UnidadArbol[]
}

/** Espejo de `QueryUnidadesDto`: `q` busca en nombre y sigla. */
export interface QueryUnidades extends PaginationQuery {
  activo?: boolean
}

export interface CreateUnidadPayload {
  nombre: string
  sigla: string
  /** Requerido al crear una raíz; en un hijo se omite (hereda el del padre). */
  grupo?: string
  activo?: boolean
  padreId?: number | null
}

export type UpdateUnidadPayload = Partial<CreateUnidadPayload>
