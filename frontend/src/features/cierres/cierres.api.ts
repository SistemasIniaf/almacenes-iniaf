import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CerrarGestionPayload,
  Cierre,
  CierreListItem,
  EstadoCierres,
  QueryCierres,
} from "@/features/cierres/cierres.types"

export async function obtenerEstadoCierres(): Promise<EstadoCierres> {
  const { data } = await api.get<EstadoCierres>("/cierres/estado")
  return data
}

export async function listarCierres(
  query: QueryCierres
): Promise<PaginatedResult<CierreListItem>> {
  const { data } = await api.get<PaginatedResult<CierreListItem>>("/cierres", {
    params: query,
  })
  return data
}

/** El cierre con su foto y el conteo de documentos: todo lo que usa el acta. */
export async function obtenerCierre(id: number): Promise<Cierre> {
  const { data } = await api.get<Cierre>(`/cierres/${id}`)
  return data
}

export async function cerrarGestion(
  payload: CerrarGestionPayload
): Promise<Cierre> {
  const { data } = await api.post<Cierre>("/cierres", payload)
  return data
}
