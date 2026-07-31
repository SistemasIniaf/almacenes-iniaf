import { Badge } from "@/components/ui/badge"
import { PUNTO } from "@/components/data/tonos-estado"
import { cn } from "@/lib/utils"

import type { TonoPunto } from "@/components/data/tonos-estado"

interface BadgeEstadoProps {
  tono: TonoPunto
  children: React.ReactNode
}

/**
 * Badge de estado: mismo fondo y misma tipografía SIEMPRE, y lo único que cambia
 * es el color de un punto.
 *
 * Antes cada estado pintaba el badge entero (verde sólido, rojo sólido, gris…) y
 * una tabla con varios estados terminaba pareciendo un semáforo, con los badges
 * peleándole la atención al dato. Así el color sigue estando —se distingue de
 * lejos— pero la fila se lee tranquila.
 *
 * Para categorías que NO son estados (el rol de un usuario, por ejemplo) sigue
 * el badge de color pleno: ahí el color identifica, no avisa.
 */
export function BadgeEstado({ tono, children }: BadgeEstadoProps) {
  return (
    <Badge
      variant="secondary"
      // Gris con tinte AZULADO (`slate`), no el `secondary` del tema, que es
      // neutro puro: al lado del verde institucional un gris frío se lee como
      // fondo y no compite, mientras que el neutro tiraba a beige.
      className="gap-1.5 bg-slate-100 font-normal text-slate-700 dark:bg-slate-700 dark:text-slate-100"
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", PUNTO[tono])}
        // El texto ya dice el estado; el punto es refuerzo visual.
        aria-hidden
      />
      {children}
    </Badge>
  )
}
