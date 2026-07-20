import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import type { PaginatedResult } from "@/lib/types"

interface DataPaginationProps {
  meta: PaginatedResult<unknown>["meta"]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** Nombre en plural de lo que se lista, para el resumen ("3 de 12 unidades"). */
  entidad: string
  /** Opciones del selector de filas por página. */
  opcionesPorPagina?: number[]
}

/**
 * Construye la lista de páginas a mostrar: siempre la primera y la última, más
 * una ventana alrededor de la actual; los huecos se marcan con "elipsis".
 * Ej. actual=6 total=20 -> [1, elipsis, 5, 6, 7, elipsis, 20].
 */
function construirRango(actual: number, total: number): (number | "elipsis")[] {
  const relevantes = new Set([1, total, actual, actual - 1, actual + 1])
  const validas = [...relevantes]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)

  const resultado: (number | "elipsis")[] = []
  let anterior = 0
  for (const p of validas) {
    if (anterior && p - anterior > 1) resultado.push("elipsis")
    resultado.push(p)
    anterior = p
  }
  return resultado
}

/**
 * Pie de paginación compartido por todos los listados. No usa el componente
 * `ui/pagination` de shadcn porque ese renderiza `<a href>` (navegación real) y
 * acá la página es estado local del listado.
 */
export function DataPagination({
  meta,
  onPageChange,
  onPageSizeChange,
  entidad,
  opcionesPorPagina = [10, 20, 30, 50],
}: DataPaginationProps) {
  const { page, pageSize, total, totalPages } = meta

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  const paginas = construirRango(page, totalPages)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            Filas por página
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(valor) => onPageSizeChange(Number(valor))}
          >
            <SelectTrigger
              className="h-8 w-[4.5rem]"
              aria-label="Filas por página"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesPorPagina.map((opcion) => (
                <SelectItem key={opcion} value={String(opcion)}>
                  {opcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="hidden text-sm whitespace-nowrap text-muted-foreground md:block">
          {total === 0
            ? `Sin ${entidad}`
            : `${desde}–${hasta} de ${total} ${entidad}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="Primera página"
        >
          <ChevronsLeft className="size-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {paginas.map((valor, indice) =>
          valor === "elipsis" ? (
            <span
              key={`elipsis-${indice}`}
              className="flex size-8 items-center justify-center text-muted-foreground"
              aria-hidden
            >
              <MoreHorizontal className="size-4" />
            </span>
          ) : (
            <Button
              key={valor}
              variant={valor === page ? "outline" : "ghost"}
              size="icon"
              className={cn("size-8", valor === page && "pointer-events-none")}
              onClick={() => onPageChange(valor)}
              aria-label={`Página ${valor}`}
              aria-current={valor === page ? "page" : undefined}
            >
              {valor}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Última página"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
