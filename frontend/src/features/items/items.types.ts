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
  /**
   * Ya figura en algún ingreso. Mientras no, se le puede corregir la partida
   * (con código nuevo) y la unidad de medida; después quedan fijas, porque
   * cambiarlas alteraría lo ya registrado (kardex, reportes).
   */
  tieneMovimientos: boolean
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

/**
 * `partidaId` y `unidadMedida` solo los acepta mientras el ítem no tenga
 * movimientos (409 si no). Cambiar la partida le da un código nuevo.
 */
export interface UpdateItemPayload {
  partidaId?: number
  descripcion?: string
  unidadMedida?: string
  activo?: boolean
}
