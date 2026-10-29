import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateTraspasoPayload,
  LoteDisponible,
  QueryTraspasos,
  Traspaso,
  TraspasoListItem,
} from "@/features/traspasos/traspasos.types"

export async function listarTraspasos(
  query: QueryTraspasos
): Promise<PaginatedResult<TraspasoListItem>> {
  const { data } = await api.get<PaginatedResult<TraspasoListItem>>(
    "/traspasos",
    { params: query }
  )
  return data
}

export async function obtenerTraspaso(id: number): Promise<Traspaso> {
  const { data } = await api.get<Traspaso>(`/traspasos/${id}`)
  return data
}

/** Todos los lotes con saldo del almacén, con lo reservado y el disponible. */
export async function lotesDeAlmacen(
  almacenId: number
): Promise<LoteDisponible[]> {
  const { data } = await api.get<LoteDisponible[]>("/traspasos/lotes", {
    params: { almacenId },
  })
  return data
}

/** Registra el traspaso: mueve los saldos y el kardex de los dos almacenes. */
export async function crearTraspaso(
  payload: CreateTraspasoPayload
): Promise<Traspaso> {
  const { data } = await api.post<Traspaso>("/traspasos", payload)
  return data
}
