import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"

import { listarStock } from "@/features/stock/stock.api"

/** Cuántos ÍTEMS trae cada tanda (cada uno puede aportar varios lotes). */
export const ITEMS_POR_BUSQUEDA = 30

/** Lo que el selector necesita saber de un lote para poder elegirlo. */
export interface LoteElegible {
  id: number
  itemCodigo: string
  itemDescripcion: string
  unidadMedida: string
  fuente: string
  numeroIngreso: string
  fechaIngreso: string
  disponible: number
}

/**
 * Lotes con disponible para armar un pedido: **búsqueda contra el servidor**,
 * igual que el selector de ítems del ingreso (el catálogo real no entra en el
 * navegador).
 *
 * Dos cosas que NO hay que perder:
 *
 * 1. Solo se ofrecen lotes con `disponible > 0` — `disponible = saldo −
 *    reservado`, no el saldo pelado. El sistema anterior ofrecía lotes agotados
 *    (`Saldo:0.00`) y de ahí salen sus saldos negativos.
 * 2. El backend ya limita al almacén del solicitante (`almacenesPermitidos`), así
 *    que no hay que filtrarlo acá ni confiar en que la pantalla lo haga.
 *
 * La paginación es por ÍTEM, no por lote: cada tanda de 30 ítems aporta todos
 * los lotes de esos ítems.
 */
export function useBuscarLotes(termino: string) {
  return useInfiniteQuery({
    queryKey: ["stock", "lotes-elegibles", termino],
    queryFn: ({ pageParam }) =>
      listarStock({
        page: pageParam,
        pageSize: ITEMS_POR_BUSQUEDA,
        conSaldo: true,
        q: termino || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.meta.page < ultima.meta.totalPages
        ? ultima.meta.page + 1
        : undefined,
    placeholderData: keepPreviousData,
    // Igual que `useBuscarItems`: sin esto, volver a un término ya visitado
    // revive de la caché todas las tandas apiladas ahí en vez de arrancar en 30.
    gcTime: 0,
    select: (data) => ({
      ...data,
      lotes: data.pages.flatMap((pagina) =>
        pagina.data.flatMap((item) =>
          item.lotes
            .filter((lote) => lote.disponible > 0)
            .map(
              (lote): LoteElegible => ({
                id: lote.id,
                itemCodigo: item.codigo,
                itemDescripcion: item.descripcion,
                unidadMedida: item.unidadMedida,
                fuente: lote.ingreso.fuenteFinanciamiento?.nombre ?? "Sin fuente",
                numeroIngreso:
                  lote.ingreso.numero != null && lote.ingreso.gestion != null
                    ? `${String(lote.ingreso.numero).padStart(3, "0")}/${lote.ingreso.gestion}`
                    : "—",
                fechaIngreso: lote.ingreso.fechaIngreso,
                disponible: lote.disponible,
              })
            )
        )
      ),
    }),
  })
}
