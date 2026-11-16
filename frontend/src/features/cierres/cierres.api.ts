import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CerrarGestionPayload,
  Cierre,
  CierreListItem,
  DatosCuadros,
  EstadoCierres,
  GestionCerrada,
  QueryCierres,
  QueryCuadros,
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

/** Gestiones con algún cierre (para elegir de cuál sacar los cuadros). */
export async function obtenerGestionesCerradas(): Promise<GestionCerrada[]> {
  const { data } = await api.get<GestionCerrada[]>("/cierres/gestiones")
  return data
}

/** Datos de los Cuadros 5 y 6: de un almacén, o institucionales. */
export async function obtenerCuadros(
  query: QueryCuadros
): Promise<DatosCuadros> {
  const { data } = await api.get<DatosCuadros>("/cierres/cuadros", {
    params: query,
  })
  return data
}
