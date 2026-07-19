import type { PartidaArbol } from "@/features/partidas/partidas.types"

/**
 * Quita acentos y pasa a minusculas, igual que hace el backend con `f_unaccent`
 * en los buscadores del servidor: buscar "combustible" encuentra "Combustíble".
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function coincide(partida: PartidaArbol, textoNormalizado: string): boolean {
  return (
    normalizarTexto(partida.codigo).includes(textoNormalizado) ||
    normalizarTexto(partida.denominacion).includes(textoNormalizado)
  )
}

/**
 * Filtra el arbol conservando la jerarquia:
 * - si un nodo coincide, se conserva con TODO su subarbol (para poder navegarlo);
 * - si no coincide pero algun descendiente si, se conserva como ancestro, con
 *   los hijos ya filtrados;
 * - si no coincide nadie en la rama, la rama desaparece.
 *
 * `soloSeleccionables` deja unicamente las hojas asignables a un Item y los
 * ancestros que hagan falta para llegar a ellas.
 */
export function filtrarArbol(
  nodos: PartidaArbol[],
  texto: string,
  soloSeleccionables: boolean
): PartidaArbol[] {
  const textoNormalizado = normalizarTexto(texto.trim())
  const sinFiltros = textoNormalizado === "" && !soloSeleccionables
  if (sinFiltros) return nodos

  const resultado: PartidaArbol[] = []

  for (const nodo of nodos) {
    const coincideTexto =
      textoNormalizado === "" || coincide(nodo, textoNormalizado)
    const coincideTipo = !soloSeleccionables || nodo.seleccionable
    const nodoCoincide = coincideTexto && coincideTipo

    // Un nodo que coincide se muestra completo; si no, se sigue buscando abajo.
    if (nodoCoincide && !soloSeleccionables) {
      resultado.push(nodo)
      continue
    }

    const hijos = filtrarArbol(nodo.hijos, texto, soloSeleccionables)
    if (nodoCoincide) {
      resultado.push({ ...nodo, hijos })
    } else if (hijos.length > 0) {
      resultado.push({ ...nodo, hijos })
    }
  }

  return resultado
}

/** Ids de todos los nodos del arbol (para expandir todo al buscar). */
export function idsDelArbol(nodos: PartidaArbol[]): number[] {
  return nodos.flatMap((nodo) => [nodo.id, ...idsDelArbol(nodo.hijos)])
}

/** Cantidad total de nodos, para el resumen del pie. */
export function contarNodos(nodos: PartidaArbol[]): number {
  return nodos.reduce((total, nodo) => total + 1 + contarNodos(nodo.hijos), 0)
}
