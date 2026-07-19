import { ChevronDown, ChevronRight, Power, PowerOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconAction } from "@/components/data/IconAction"
import { NIVEL_LABEL } from "@/features/partidas/partidas.types"
import { cn } from "@/lib/utils"

import type { PartidaArbol } from "@/features/partidas/partidas.types"

interface PartidaNodoProps {
  partida: PartidaArbol
  /** Profundidad visual (0 = raíz); solo afecta la sangría. */
  profundidad: number
  expandidos: Set<number>
  onToggle: (id: number) => void
  puedeEscribir: boolean
  onActivar: (partida: PartidaArbol) => void
  onDesactivar: (partida: PartidaArbol) => void
}

export function PartidaNodo({
  partida,
  profundidad,
  expandidos,
  onToggle,
  puedeEscribir,
  onActivar,
  onDesactivar,
}: PartidaNodoProps) {
  const tieneHijos = partida.hijos.length > 0
  const expandido = expandidos.has(partida.id)

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0 hover:bg-muted/50",
          !partida.activo && "opacity-60"
        )}
        style={{ paddingLeft: `${profundidad * 1.5 + 0.5}rem` }}
      >
        {tieneHijos ? (
          <Button
            variant="ghost"
            size="sm"
            className="size-6 shrink-0 p-0"
            onClick={() => onToggle(partida.id)}
            aria-label={expandido ? "Contraer" : "Expandir"}
            aria-expanded={expandido}
          >
            {expandido ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        ) : (
          // Hueco del mismo ancho que el chevron, para que las hojas no bailen.
          <span className="size-6 shrink-0" />
        )}

        <code className="shrink-0 font-mono text-sm font-medium">
          {partida.codigo}
        </code>

        <span className="flex-1 truncate text-sm">{partida.denominacion}</span>

        <Badge variant="outline" className="shrink-0">
          {NIVEL_LABEL[partida.nivel] ?? `Nivel ${partida.nivel}`}
        </Badge>

        {partida.seleccionable && (
          <Badge
            variant="secondary"
            className="shrink-0"
            title="Se le pueden asignar ítems"
          >
            Asignable
          </Badge>
        )}

        {!partida.activo && (
          <Badge variant="destructive" className="shrink-0">
            Inactiva
          </Badge>
        )}

        {puedeEscribir && (
          <span className="shrink-0">
            {partida.activo ? (
              <IconAction
                icono={PowerOff}
                etiqueta="Desactivar"
                onClick={() => onDesactivar(partida)}
                destructiva
              />
            ) : (
              <IconAction
                icono={Power}
                etiqueta="Activar"
                onClick={() => onActivar(partida)}
              />
            )}
          </span>
        )}
      </div>

      {tieneHijos &&
        expandido &&
        partida.hijos.map((hijo) => (
          <PartidaNodo
            key={hijo.id}
            partida={hijo}
            profundidad={profundidad + 1}
            expandidos={expandidos}
            onToggle={onToggle}
            puedeEscribir={puedeEscribir}
            onActivar={onActivar}
            onDesactivar={onDesactivar}
          />
        ))}
    </>
  )
}
