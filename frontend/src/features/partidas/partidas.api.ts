import { api } from "@/lib/api"

import type { Partida, PartidaArbol } from "@/features/partidas/partidas.types"

/**
 * Arbol jerarquico completo. El catalogo es acotado (~120 nodos, ~29 KB), asi
 * que se trae entero una sola vez y el filtrado se hace en el cliente: evita
 * una peticion por tecla y permite conservar los ancestros de cada coincidencia.
 */
export async function obtenerArbolPartidas(): Promise<PartidaArbol[]> {
  const { data } = await api.get<PartidaArbol[]>("/partidas/arbol")
  return data
}

export async function activarPartida(id: number): Promise<Partida> {
  const { data } = await api.patch<Partida>(`/partidas/${id}/activar`)
  return data
}

export async function desactivarPartida(id: number): Promise<Partida> {
  const { data } = await api.patch<Partida>(`/partidas/${id}/desactivar`)
  return data
}
