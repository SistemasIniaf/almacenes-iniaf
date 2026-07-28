import { api } from "@/lib/api"

import type { Kardex, QueryKardex } from "@/features/kardex/kardex.types"

export async function obtenerKardex(query: QueryKardex): Promise<Kardex> {
  const { data } = await api.get<Kardex>("/kardex", { params: query })
  return data
}
