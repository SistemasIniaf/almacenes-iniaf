import { useState } from "react"

import { PAGE_SIZE } from "@/lib/types"

/**
 * Estado de paginación de un listado (página actual + filas por página),
 * compartido por todas las páginas de dominio.
 */
export function usePagination(pageSizeInicial: number = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(pageSizeInicial)

  /** Cambiar el tamaño de página reinicia a la 1: los índices anteriores ya no valen. */
  function setPageSize(nuevo: number) {
    setPageSizeRaw(nuevo)
    setPage(1)
  }

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    /** Vuelve a la primera página; se usa al cambiar cualquier filtro. */
    resetPage: () => setPage(1),
  }
}
