import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  FilaReporteStock,
  ItemStock,
  PartidaStock,
  QueryStock,
} from "@/features/stock/stock.types"

export async function listarStock(
  query: QueryStock
): Promise<PaginatedResult<ItemStock>> {
  const { data } = await api.get<PaginatedResult<ItemStock>>("/stock", {
    params: query,
  })
  return data
}

/** Solo las partidas que hoy tienen existencias (alimenta el selector). */
export async function listarPartidasConStock(
  query: QueryStock
): Promise<PartidaStock[]> {
  const { data } = await api.get<PartidaStock[]>("/stock/partidas", {
    params: query,
  })
  return data
}

/** Todas las existencias, sin paginar, agregadas para el reporte imprimible. */
export async function obtenerReporteStock(
  query: QueryStock
): Promise<FilaReporteStock[]> {
  const { data } = await api.get<FilaReporteStock[]>("/stock/reporte", {
    params: query,
  })
  return data
}
