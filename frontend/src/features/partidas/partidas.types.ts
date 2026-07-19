export interface Partida {
  id: number
  codigo: string
  denominacion: string
  /** 1 = Grupo, 2 = Subgrupo, 3 = Partida, 4 = Subpartida, 5 = Sub-subpartida. */
  nivel: number
  /** Solo los nodos hoja son asignables a un Ítem. */
  seleccionable: boolean
  activo: boolean
  ultimoCorrelativo: number
  padreId: number | null
  createdAt: string
  updatedAt: string
}

/** Nodo del árbol jerárquico que devuelve `GET /partidas/arbol`. */
export interface PartidaArbol extends Partida {
  hijos: PartidaArbol[]
}

export const NIVEL_LABEL: Record<number, string> = {
  1: "Grupo",
  2: "Subgrupo",
  3: "Partida",
  4: "Subpartida",
  5: "Sub-subpartida",
}
