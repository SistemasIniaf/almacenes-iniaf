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
      // En CLARO, gris con tinte azulado (`slate`) en vez del `secondary` del
      // tema, que es neutro puro y al lado del verde institucional tiraba a
      // beige. En OSCURO manda el `secondary` del tema: ahí el neutro ya
      // funciona y un slate propio se despegaba del resto de la interfaz.
      className="gap-1.5 bg-slate-100 font-normal text-slate-700 dark:bg-secondary dark:text-secondary-foreground"
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
