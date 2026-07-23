import type { PaginationQuery } from "@/lib/types"

/** Unidad del catálogo compartido, tal como la trae el almacén (aplanada). */
export interface UnidadDeAlmacen {
  id: number
  nombre: string
  sigla: string
  activo: boolean
  grupo: string | null
  padreId: number | null
}

export interface Almacen {
  id: number
  nombre: string
  activo: boolean
  /** Unidades que este almacén muestra en el selector de "unidad solicitante". */
  unidades: UnidadDeAlmacen[]
  createdAt: string
  updatedAt: string
}

/** Espejo de `QueryAlmacenesDto`: `q` busca solo en nombre. */
export interface QueryAlmacenes extends PaginationQuery {
  activo?: boolean
  /** `nombre` = alfabético (selectores); sin él, por fecha (listados). */
  orden?: "nombre"
}

export interface CreateAlmacenPayload {
  nombre: string
  activo?: boolean
  /** Ids de las unidades (catálogo compartido) que muestra el almacén. */
  unidadIds?: number[]
}

export type UpdateAlmacenPayload = Partial<CreateAlmacenPayload>
