import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  Almacen,
  CreateAlmacenPayload,
  QueryAlmacenes,
  UpdateAlmacenPayload,
} from "@/features/almacenes/almacenes.types"

export async function listarAlmacenes(
  query: QueryAlmacenes
): Promise<PaginatedResult<Almacen>> {
  const { data } = await api.get<PaginatedResult<Almacen>>("/almacenes", {
    params: query,
  })
  return data
}

export async function obtenerAlmacen(id: number): Promise<Almacen> {
  const { data } = await api.get<Almacen>(`/almacenes/${id}`)
  return data
}

export async function crearAlmacen(
  payload: CreateAlmacenPayload
): Promise<Almacen> {
  const { data } = await api.post<Almacen>("/almacenes", payload)
  return data
}

export async function actualizarAlmacen(
  id: number,
  payload: UpdateAlmacenPayload
): Promise<Almacen> {
  const { data } = await api.patch<Almacen>(`/almacenes/${id}`, payload)
  return data
}

/** Baja logica: el backend hace `activo = false`, no borra. */
export async function desactivarAlmacen(id: number): Promise<Almacen> {
  const { data } = await api.delete<Almacen>(`/almacenes/${id}`)
  return data
}
