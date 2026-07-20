import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  activarPartida,
  desactivarPartida,
  obtenerArbolPartidas,
} from "@/features/partidas/partidas.api"
import { getApiErrorMessage } from "@/lib/api"

import type { Partida, PartidaArbol } from "@/features/partidas/partidas.types"

export const partidasKeys = {
  all: ["partidas"] as const,
  arbol: () => ["partidas", "arbol"] as const,
}

export function useArbolPartidas() {
  return useQuery({
    queryKey: partidasKeys.arbol(),
    queryFn: obtenerArbolPartidas,
    // El clasificador cambia poquisimo (solo si el Ministerio publica una
    // actualizacion), asi que no vale la pena refrescarlo seguido.
    staleTime: 10 * 60_000,
  })
}

/**
 * Partidas SELECCIONABLES (hojas del clasificador) con "activo efectivo",
 * aplanadas para poblar el selector del formulario de items — son las unicas a
 * las que el backend permite asignar un item.
 *
 * "Activo efectivo": una hoja aparece solo si ella Y toda su cadena de
 * ancestros estan activas. Asi, desactivar un grupo (o cualquier nodo padre)
 * inhabilita toda su rama, sin tocar el estado individual de las hojas. El
 * backend valida lo mismo al crear (ver items.service.ts).
 *
 * Reutiliza la query del arbol, asi que no dispara una peticion extra.
 */
export function usePartidasSeleccionables() {
  return useQuery({
    queryKey: partidasKeys.arbol(),
    queryFn: obtenerArbolPartidas,
    staleTime: 10 * 60_000,
    select: (arbol) => {
      const hojas: Partida[] = []
      const recorrer = (nodos: PartidaArbol[], ancestrosActivos: boolean) => {
        for (const nodo of nodos) {
          const activoEfectivo = ancestrosActivos && nodo.activo
          if (nodo.seleccionable && activoEfectivo) hojas.push(nodo)
          recorrer(nodo.hijos, activoEfectivo)
        }
      }
      recorrer(arbol, true)
      return hojas
    },
  })
}

/** Activa o desactiva una partida (baja logica; no hay cascada a los hijos). */
export function useCambiarEstadoPartida() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, activar }: { id: number; activar: boolean }) =>
      activar ? activarPartida(id) : desactivarPartida(id),
    onSuccess: (partida) => {
      void queryClient.invalidateQueries({ queryKey: partidasKeys.all })
      toast.success(
        partida.activo
          ? `Partida ${partida.codigo} activada`
          : `Partida ${partida.codigo} desactivada`
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
