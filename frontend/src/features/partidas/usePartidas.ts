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
 * Partidas ACTIVAS y SELECCIONABLES (hojas del clasificador), aplanadas para
 * poblar el selector del formulario de items — son las unicas a las que el
 * backend permite asignar un item.
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
      const recorrer = (nodos: PartidaArbol[]) => {
        for (const nodo of nodos) {
          if (nodo.seleccionable && nodo.activo) hojas.push(nodo)
          recorrer(nodo.hijos)
        }
      }
      recorrer(arbol)
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
