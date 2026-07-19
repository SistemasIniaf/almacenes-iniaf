import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { PaginatedResult } from "@/lib/types"

interface DataPaginationProps {
  meta: PaginatedResult<unknown>["meta"]
  onPageChange: (page: number) => void
  /** Nombre en plural de lo que se lista, para el resumen ("3 de 12 unidades"). */
  entidad: string
}

/**
 * Pie de paginacion compartido por todos los listados. No usa el componente
 * `ui/pagination` de shadcn porque ese renderiza `<a href>` (navegacion real) y
 * aca la pagina es estado local del listado.
 */
export function DataPagination({
  meta,
  onPageChange,
  entidad,
}: DataPaginationProps) {
  const { page, pageSize, total, totalPages } = meta

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? `Sin ${entidad}`
          : `Mostrando ${desde}–${hasta} de ${total} ${entidad}`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
