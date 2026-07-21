import type { UnidadArbol } from "@/features/unidades/unidades.types"

/**
 * Quita acentos y pasa a minusculas, igual que hace el backend con `f_unaccent`
 * en los buscadores del servidor: buscar "administracion" encuentra "Administración".
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function coincide(unidad: UnidadArbol, textoNormalizado: string): boolean {
  return (
    normalizarTexto(unidad.nombre).includes(textoNormalizado) ||
    normalizarTexto(unidad.sigla).includes(textoNormalizado)
  )
}

/**
 * Filtra el arbol conservando la jerarquia:
 * - si un nodo coincide, se conserva con TODO su subarbol (para poder navegarlo);
 * - si no coincide pero algun descendiente si, se conserva como ancestro, con
 *   los hijos ya filtrados;
 * - si no coincide nadie en la rama, la rama desaparece.
 *
 * `soloActivas` deja unicamente las unidades activas y los ancestros que hagan
 * falta para llegar a ellas.
 */
export function filtrarArbol(
  nodos: UnidadArbol[],
  texto: string,
  soloActivas: boolean
): UnidadArbol[] {
  const textoNormalizado = normalizarTexto(texto.trim())
  const sinFiltros = textoNormalizado === "" && !soloActivas
  if (sinFiltros) return nodos

  const resultado: UnidadArbol[] = []

  for (const nodo of nodos) {
    const coincideTexto =
      textoNormalizado === "" || coincide(nodo, textoNormalizado)
    const coincideEstado = !soloActivas || nodo.activo
    const nodoCoincide = coincideTexto && coincideEstado

    // Un nodo que coincide se muestra completo; si no, se sigue buscando abajo.
    if (nodoCoincide && !soloActivas) {
      resultado.push(nodo)
      continue
    }

    const hijos = filtrarArbol(nodo.hijos, texto, soloActivas)
    if (nodoCoincide) {
      resultado.push({ ...nodo, hijos })
    } else if (hijos.length > 0) {
      resultado.push({ ...nodo, hijos })
    }
  }

  return resultado
}

/** Ids de todos los nodos del arbol (para expandir todo al buscar). */
export function idsDelArbol(nodos: UnidadArbol[]): number[] {
  return nodos.flatMap((nodo) => [nodo.id, ...idsDelArbol(nodo.hijos)])
}

/** Cantidad total de nodos, para el resumen del pie. */
export function contarNodos(nodos: UnidadArbol[]): number {
  return nodos.reduce((total, nodo) => total + 1 + contarNodos(nodo.hijos), 0)
}

/** Cuenta los hijos (directos e indirectos) de una unidad. */
export function contarDescendientes(nodo: UnidadArbol): number {
  return nodo.hijos.reduce(
    (total, hijo) => total + 1 + contarDescendientes(hijo),
    0
  )
}
