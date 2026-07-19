import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { LucideIcon } from "lucide-react"

interface IconActionProps {
  icono: LucideIcon
  /** Texto del tooltip y `aria-label` del boton: el verbo de la accion. */
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  /** Pinta la accion en rojo (desactivar, eliminar). */
  destructiva?: boolean
}

/**
 * Boton de accion de una fila de tabla: solo icono + tooltip.
 *
 * El boton va envuelto en un `<span>` porque un `<button disabled>` no emite
 * eventos de puntero y Radix nunca mostraria el tooltip — justo en el caso en
 * que mas se necesita explicar por que la accion no esta disponible.
 */
export function IconAction({
  icono: Icono,
  etiqueta,
  onClick,
  disabled = false,
  destructiva = false,
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={etiqueta}
            className={
              destructiva && !disabled
                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                : undefined
            }
          >
            <Icono className="size-4" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  )
}
