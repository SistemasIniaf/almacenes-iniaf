import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import {
  cerrarGestion,
  listarCierres,
  obtenerEstadoCierres,
} from "@/features/cierres/cierres.api"

import type {
  CerrarGestionPayload,
  QueryCierres,
} from "@/features/cierres/cierres.types"

export const cierresKeys = {
  all: ["cierres"] as const,
  estado: ["cierres", "estado"] as const,
  lista: (query: QueryCierres) => ["cierres", "lista", query] as const,
}

export function useEstadoCierres() {
  return useQuery({
    queryKey: cierresKeys.estado,
    queryFn: obtenerEstadoCierres,
    // Los pedidos que traban el cierre cambian todo el tiempo: siempre fresco.
    staleTime: 0,
  })
}

export function useCierres(query: QueryCierres) {
  return useQuery({
    queryKey: cierresKeys.lista(query),
    queryFn: () => listarCierres(query),
    placeholderData: keepPreviousData,
  })
}

/**
 * Los toasts quedan en quien llama: el de éxito ofrece abrir el acta, y eso
 * necesita el gesto de un clic (el navegador bloquea una pestaña abierta sola).
 */
export function useCerrarGestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CerrarGestionPayload) => cerrarGestion(payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cierresKeys.all })
    },
  })
}
