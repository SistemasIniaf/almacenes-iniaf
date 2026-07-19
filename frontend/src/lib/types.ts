/** Forma estandar de todo listado paginado del backend (helper `paginated()`). */
export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * Registros por pagina en todos los listados. Centralizado aca para no tener
 * que tocar cada modulo si cambia.
 */
export const PAGE_SIZE = 10

/** Query base de los listados; cada modulo la extiende con sus filtros. */
export interface PaginationQuery {
  page?: number
  pageSize?: number
  q?: string
}
