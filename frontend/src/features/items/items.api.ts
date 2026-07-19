import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateItemPayload,
  Item,
  QueryItems,
  UpdateItemPayload,
} from "@/features/items/items.types"

export async function listarItems(
  query: QueryItems
): Promise<PaginatedResult<Item>> {
  const { data } = await api.get<PaginatedResult<Item>>("/items", {
    params: query,
  })
  return data
}

export async function obtenerItem(id: number): Promise<Item> {
  const { data } = await api.get<Item>(`/items/${id}`)
  return data
}

export async function crearItem(payload: CreateItemPayload): Promise<Item> {
  const { data } = await api.post<Item>("/items", payload)
  return data
}

export async function actualizarItem(
  id: number,
  payload: UpdateItemPayload
): Promise<Item> {
  const { data } = await api.patch<Item>(`/items/${id}`, payload)
  return data
}

/** Baja logica: el backend hace `activo = false`, no borra. */
export async function desactivarItem(id: number): Promise<Item> {
  const { data } = await api.delete<Item>(`/items/${id}`)
  return data
}

/**
 * Sube (o reemplaza) la imagen referencial. El campo multipart se llama
 * `imagen`. No se fija el Content-Type: axios lo arma con el boundary correcto
 * al detectar un FormData (ver el comentario en `lib/api.ts`).
 */
export async function subirImagenItem(
  id: number,
  archivo: File
): Promise<Item> {
  const formData = new FormData()
  formData.append("imagen", archivo)

  const { data } = await api.post<Item>(`/items/${id}/imagen`, formData)
  return data
}

export async function quitarImagenItem(id: number): Promise<Item> {
  const { data } = await api.delete<Item>(`/items/${id}/imagen`)
  return data
}
