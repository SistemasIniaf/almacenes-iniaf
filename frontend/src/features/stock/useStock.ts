import { keepPreviousData, useQuery } from "@tanstack/react-query"

import {
  listarPartidasConStock,
  listarStock,
} from "@/features/stock/stock.api"

import type { QueryStock } from "@/features/stock/stock.types"

export function useStock(query: QueryStock) {
  return useQuery({
    queryKey: ["stock", query],
    queryFn: () => listarStock(query),
    placeholderData: keepPreviousData,
  })
}

/**
 * Partidas con existencias. Se pasan los mismos filtros de almacén y fuente
 * (no el de partida) para que el selector no ofrezca opciones sin resultados.
 */
export function usePartidasConStock(query: QueryStock) {
  return useQuery({
    queryKey: ["stock", "partidas", query],
    queryFn: () => listarPartidasConStock(query),
    staleTime: 60_000,
  })
}
