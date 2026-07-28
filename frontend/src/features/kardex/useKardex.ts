import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { obtenerKardex } from "@/features/kardex/kardex.api"

import type { QueryKardex } from "@/features/kardex/kardex.types"

/** Sin ítem elegido no hay libro que pedir: la consulta queda deshabilitada. */
export function useKardex(query: QueryKardex | null) {
  return useQuery({
    queryKey: ["kardex", query],
    queryFn: () => obtenerKardex(query as QueryKardex),
    enabled: query != null,
    placeholderData: keepPreviousData,
  })
}
