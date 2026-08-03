import { api } from "@/lib/api"

import type {
  Kardex,
  QueryKardex,
  QueryReporteKardex,
  ReporteKardex,
} from "@/features/kardex/kardex.types"

export async function obtenerKardex(query: QueryKardex): Promise<Kardex> {
  const { data } = await api.get<Kardex>("/kardex", { params: query })
  return data
}

/**
 * El kardex de TODOS los ítems del almacén, sin paginar, para el reporte. Se
 * agrega en el servidor: son todos los movimientos de la gestión y el saldo de
 * apertura de cada bloque.
 */
export async function obtenerReporteKardex(
  query: QueryReporteKardex
): Promise<ReporteKardex> {
  const { data } = await api.get<ReporteKardex>("/kardex/reporte", {
    params: query,
  })
  return data
}
