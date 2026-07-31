import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { LucideIcon } from "lucide-react"

interface IconActionProps {
  icono: LucideIcon
  /** Texto del tooltip y `aria-label` del boton: el verbo de la accion. */
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  /** Pinta la accion en rojo (desactivar, eliminar). */
  destructiva?: boolean
  /** Hace girar el icono mientras la accion esta en curso. */
  cargando?: boolean
  /**
   * Color propio del icono, para acciones que se identifican por su color sin
   * ser destructivas — el rojo del PDF, por ejemplo. No usar `destructiva` para
   * eso: ahi el rojo significa «cuidado», no «documento».
   */
  className?: string
  /**
   * Clases para el SVG. Sirve para invertir un icono de lucide, que se dibuja
   * con trazo y sin relleno: con `fill-current stroke-background` queda macizo
   * del color del texto y sus líneas internas se ven del color del fondo.
   */
  iconoClassName?: string
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
  cargando = false,
  className,
  iconoClassName,
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            // `icon-sm` y no `sm`: el botón queda cuadrado, sin el `px-2.5` que
            // separaba de más los iconos de una misma fila.
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={etiqueta}
            className={cn(
              destructiva &&
                !disabled &&
                "text-destructive hover:bg-destructive/10 hover:text-destructive",
              !disabled && className
            )}
          >
            <Icono
              className={cn(
                cargando ? "size-4 animate-spin" : "size-4",
                iconoClassName
              )}
            />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  )
}
