import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"

import { listarItems } from "@/features/items/items.api"

/** Cuántos ítems trae cada tanda del selector. */
export const ITEMS_POR_BUSQUEDA = 50

/**
 * Ítems del catálogo para un selector: **búsqueda contra el servidor, paginada
 * de a tandas** (el combo pide la siguiente al llegar al final).
 *
 * El catálogo real del INIAF tiene ~23.000 ítems, así que nunca se trae entero:
 * se piden 50 por vez (`q` resuelto en el backend, sin acentos y con índice GIN
 * sobre código + descripción). Sin término se muestran los primeros por
 * descripción, solo para que la lista no arranque vacía.
 *
 * Paginar acá es seguro porque el backend desempata el orden por `id`: sin ese
 * desempate, dos ítems con la misma descripción podrían repetirse o perderse
 * entre tandas.
 *
 * Vive en `items` y no en la feature que lo usa: lo comparten el formulario de
 * ingreso y el kardex.
 */
export function useBuscarItems(termino: string) {
  return useInfiniteQuery({
    queryKey: ["items", "buscar", termino],
    queryFn: ({ pageParam }) =>
      listarItems({
        page: pageParam,
        pageSize: ITEMS_POR_BUSQUEDA,
        activo: true,
        orden: "descripcion",
        q: termino || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.meta.page < ultima.meta.totalPages
        ? ultima.meta.page + 1
        : undefined,
    // Mantiene la lista anterior mientras llega la nueva: al tipear, el combo no
    // parpadea a vacío entre términos.
    placeholderData: keepPreviousData,
    // `gcTime: 0` descarta las tandas apiladas apenas el término deja de estar
    // en uso. Sin esto, volver a un término ya visitado (típico: vaciar el
    // filtro) revive de la caché las 300 o 500 filas que habías cargado ahí, en
    // vez de arrancar en 50 como cualquier otra búsqueda.
    gcTime: 0,
  })
}
