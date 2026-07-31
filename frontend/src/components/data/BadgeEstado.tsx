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
      // El fondo NO usa el `secondary` del tema, en ningún tema:
      //
      // - En CLARO tira a beige al lado del verde institucional; va un gris con
      //   tinte azulado (`slate`).
      // - En OSCURO desentona por el HUE: todo el tema oscuro está en un azul de
      //   216-229 (`--background` 228.8, `--card` 223.9, `--muted` 216.9) y
      //   `--secondary` quedó en 286, o sea violáceo — se ve como el único
      //   elemento de otro color en la pantalla. Se usa `muted`, que tiene
      //   prácticamente el mismo brillo (0.275 contra 0.274) pero el tinte del
      //   resto de la interfaz.
      className="gap-1.5 bg-slate-100 font-normal text-slate-700 dark:bg-muted dark:text-foreground"
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
