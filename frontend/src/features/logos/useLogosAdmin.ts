import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  eliminarVersion,
  obtenerHistorial,
  reemplazarLogo,
  restaurarLogo,
  usarVersion,
} from "@/features/logos/logos.api"
import { getApiErrorMessage } from "@/lib/api"
import { logosKeys } from "@/lib/logos"

import type { LogoClave, LogosVigentes } from "@/lib/logos"

/**
 * El historial cuelga de la misma raíz que los logos vigentes, pero es otra
 * consulta: los vigentes son públicos (los pide el login) y el historial es
 * solo del super_admin.
 */
const historialKey = [...logosKeys.all, "historial"] as const

export function useHistorialLogos() {
  return useQuery({ queryKey: historialKey, queryFn: obtenerHistorial })
}

/**
 * Las mutaciones que cambian qué logo rige devuelven los tres casilleros: se
 * escriben directo en la caché, y con eso el login, el menú y los documentos
 * que se generen desde ahora toman el logo nuevo sin otra consulta. El
 * historial sí se vuelve a pedir: todas lo tocan (una versión nueva, o cuál
 * está marcada como vigente).
 */
function useAlCambiarVigentes() {
  const queryClient = useQueryClient()
  return (logos: LogosVigentes) => {
    queryClient.setQueryData(logosKeys.all, logos)
    void queryClient.invalidateQueries({ queryKey: historialKey })
  }
}

export function useReemplazarLogo() {
  const alCambiar = useAlCambiarVigentes()
  return useMutation({
    mutationFn: ({ clave, archivo }: { clave: LogoClave; archivo: File }) =>
      reemplazarLogo(clave, archivo),
    onSuccess: (logos) => {
      alCambiar(logos)
      toast.success("Logo reemplazado. El anterior quedó en el historial.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useRestaurarLogo() {
  const alCambiar = useAlCambiarVigentes()
  return useMutation({
    mutationFn: (clave: LogoClave) => restaurarLogo(clave),
    onSuccess: (logos) => {
      alCambiar(logos)
      toast.success("Se restauró el logo original")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useUsarVersion() {
  const alCambiar = useAlCambiarVigentes()
  return useMutation({
    mutationFn: (id: number) => usarVersion(id),
    onSuccess: (logos) => {
      alCambiar(logos)
      toast.success("Logo restablecido desde el historial")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useEliminarVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => eliminarVersion(id),
    onSuccess: (historial) => {
      queryClient.setQueryData(historialKey, historial)
      toast.success("Logo eliminado del historial")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
