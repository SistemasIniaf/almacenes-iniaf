import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateFuenteFinanciamientoPayload,
  FuenteFinanciamiento,
  QueryFuentesFinanciamiento,
  UpdateFuenteFinanciamientoPayload,
} from "@/features/fuentes-financiamiento/fuentes-financiamiento.types"

export async function listarFuentes(
  query: QueryFuentesFinanciamiento
): Promise<PaginatedResult<FuenteFinanciamiento>> {
  const { data } = await api.get<PaginatedResult<FuenteFinanciamiento>>(
    "/fuentes-financiamiento",
    { params: query }
  )
  return data
}

export async function obtenerFuente(
  id: number
): Promise<FuenteFinanciamiento> {
  const { data } = await api.get<FuenteFinanciamiento>(
    `/fuentes-financiamiento/${id}`
  )
  return data
}

export async function crearFuente(
  payload: CreateFuenteFinanciamientoPayload
): Promise<FuenteFinanciamiento> {
  const { data } = await api.post<FuenteFinanciamiento>(
    "/fuentes-financiamiento",
    payload
  )
  return data
}

export async function actualizarFuente(
  id: number,
  payload: UpdateFuenteFinanciamientoPayload
): Promise<FuenteFinanciamiento> {
  const { data } = await api.patch<FuenteFinanciamiento>(
    `/fuentes-financiamiento/${id}`,
    payload
  )
  return data
}

/**
 * Baja logica. Nunca se borra fisicamente: la fuente queda referenciada por los
 * lotes de Ingreso y eliminarla rompería el Kardex.
 */
export async function desactivarFuente(
  id: number
): Promise<FuenteFinanciamiento> {
  const { data } = await api.delete<FuenteFinanciamiento>(
    `/fuentes-financiamiento/${id}`
  )
  return data
}
