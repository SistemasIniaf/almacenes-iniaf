import { ChevronDown, ChevronRight, Pencil, Power, PowerOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconAction } from "@/components/data/IconAction"
import { cn } from "@/lib/utils"

import type { UnidadArbol } from "@/features/unidades/unidades.types"

interface UnidadNodoProps {
  unidad: UnidadArbol
  /** Profundidad visual (0 = raiz); solo afecta la sangria. */
  profundidad: number
  expandidos: Set<number>
  onToggle: (id: number) => void
  puedeEscribir: boolean
  onEditar: (unidad: UnidadArbol) => void
  onActivar: (unidad: UnidadArbol) => void
  onDesactivar: (unidad: UnidadArbol) => void
}

export function UnidadNodo({
  unidad,
  profundidad,
  expandidos,
  onToggle,
  puedeEscribir,
  onEditar,
  onActivar,
  onDesactivar,
}: UnidadNodoProps) {
  const tieneHijos = unidad.hijos.length > 0
  const expandido = expandidos.has(unidad.id)

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0 hover:bg-muted/50",
          !unidad.activo && "opacity-60"
        )}
        style={{ paddingLeft: `${profundidad * 1.5 + 0.5}rem` }}
      >
        {tieneHijos ? (
          <Button
            variant="ghost"
            size="sm"
            className="size-6 shrink-0 p-0"
            onClick={() => onToggle(unidad.id)}
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

        <span className="flex-1 truncate text-sm font-medium">
          {unidad.nombre}
        </span>

        <Badge variant="outline" className="shrink-0 font-mono">
          {unidad.sigla}
        </Badge>

        {!unidad.activo && (
          <Badge variant="destructive" className="shrink-0">
            Inactiva
          </Badge>
        )}

        {puedeEscribir && (
          <span className="flex shrink-0 items-center gap-0.5">
            <IconAction
              icono={Pencil}
              etiqueta="Editar"
              onClick={() => onEditar(unidad)}
            />
            {unidad.activo ? (
              <IconAction
                icono={PowerOff}
                etiqueta="Desactivar"
                onClick={() => onDesactivar(unidad)}
                destructiva
              />
            ) : (
              <IconAction
                icono={Power}
                etiqueta="Activar"
                onClick={() => onActivar(unidad)}
              />
            )}
          </span>
        )}
      </div>

      {tieneHijos &&
        expandido &&
        unidad.hijos.map((hijo) => (
          <UnidadNodo
            key={hijo.id}
            unidad={hijo}
            profundidad={profundidad + 1}
            expandidos={expandidos}
            onToggle={onToggle}
            puedeEscribir={puedeEscribir}
            onEditar={onEditar}
            onActivar={onActivar}
            onDesactivar={onDesactivar}
          />
        ))}
    </>
  )
}
