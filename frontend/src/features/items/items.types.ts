import type { PaginationQuery } from "@/lib/types"

/** Partida anidada que devuelve el backend en cada ítem. */
export interface ItemPartida {
  id: number
  codigo: string
  denominacion: string
}

export interface Item {
  id: number
  /** Autogenerado `{partida.codigo}-{correlativo}`; no se envía ni se edita. */
  codigo: string
  descripcion: string
  unidadMedida: string
  /** Ruta relativa (ej. "/uploads/items/3-ab12cd34.webp") o null. */
  imagenUrl: string | null
  activo: boolean
  partidaId: number
  partida: ItemPartida
  createdAt: string
  updatedAt: string
}

export interface QueryItems extends PaginationQuery {
  activo?: boolean
  partidaId?: number
  /** `descripcion`/`codigo` = alfabético (selectores); sin él, por fecha. */
  orden?: "descripcion" | "codigo"
}

export interface CreateItemPayload {
  descripcion: string
  unidadMedida: string
  partidaId: number
  activo?: boolean
}

/** El update NO admite `codigo` ni `partidaId` (el código deriva de la partida). */
export interface UpdateItemPayload {
  descripcion?: string
  unidadMedida?: string
  activo?: boolean
}
