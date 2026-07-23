import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateUnidadPayload,
  QueryUnidades,
  Unidad,
  UnidadArbol,
  UpdateUnidadPayload,
} from "@/features/unidades/unidades.types"

export async function listarUnidades(
  query: QueryUnidades
): Promise<PaginatedResult<Unidad>> {
  const { data } = await api.get<PaginatedResult<Unidad>>("/unidades", {
    // axios omite los `undefined`, asi que los filtros vacios no viajan.
    params: query,
  })
  return data
}

/** Arbol jerarquico completo de unidades. */
export async function obtenerArbolUnidades(params?: {
  soloActivas?: boolean
}): Promise<UnidadArbol[]> {
  const { data } = await api.get<UnidadArbol[]>("/unidades/arbol", { params })
  return data
}

/** Grupos existentes (distinct), para el selector al crear una unidad raíz. */
export async function obtenerGruposUnidades(): Promise<string[]> {
  const { data } = await api.get<string[]>("/unidades/grupos")
  return data
}

export async function obtenerUnidad(id: number): Promise<Unidad> {
  const { data } = await api.get<Unidad>(`/unidades/${id}`)
  return data
}

export async function crearUnidad(
  payload: CreateUnidadPayload
): Promise<Unidad> {
  const { data } = await api.post<Unidad>("/unidades", payload)
  return data
}

export async function actualizarUnidad(
  id: number,
  payload: UpdateUnidadPayload
): Promise<Unidad> {
  const { data } = await api.patch<Unidad>(`/unidades/${id}`, payload)
  return data
}

/** Baja logica: el backend hace `activo = false`, no borra. */
export async function desactivarUnidad(id: number): Promise<Unidad> {
  const { data } = await api.delete<Unidad>(`/unidades/${id}`)
  return data
}
