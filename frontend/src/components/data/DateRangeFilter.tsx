import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import type { DateRange } from "react-day-picker"

/**
 * Filtro de rango de fechas para los listados: `Popover` + `Calendar` en modo
 * `range`, con dos meses a la vista y atajos de período.
 *
 * NO es un campo de react-hook-form (a diferencia de `DatePickerField`): es un
 * filtro suelto de pantalla, así que recibe valor y callback en vez de
 * `control`/`name`.
 *
 * Reemplazó a dos `<input type="date">` sueltos: con dos campos había que
 * tipear las dos fechas sin ver el calendario, y nada impedía cerrar un rango
 * al revés.
 */

const formatoCorto = (fecha: Date) =>
  fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

/** Etiqueta del botón: un extremo suelto también se muestra. */
function etiqueta(rango: DateRange | undefined, placeholder: string) {
  if (!rango?.from && !rango?.to) return placeholder
  if (rango.from && rango.to) {
    return `${formatoCorto(rango.from)} – ${formatoCorto(rango.to)}`
  }
  if (rango.from) return `Desde ${formatoCorto(rango.from)}`
  return `Hasta ${formatoCorto(rango.to as Date)}`
}

/** Atajos: en un reporte contable el período casi siempre es uno de estos. */
function atajos(): { nombre: string; rango: DateRange }[] {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()

  return [
    {
      nombre: "Este mes",
      rango: { from: new Date(anio, mes, 1), to: hoy },
    },
    {
      nombre: "Mes pasado",
      rango: { from: new Date(anio, mes - 1, 1), to: new Date(anio, mes, 0) },
    },
    {
      nombre: "Esta gestión",
      rango: { from: new Date(anio, 0, 1), to: hoy },
    },
    {
      nombre: "Gestión anterior",
      rango: {
        from: new Date(anio - 1, 0, 1),
        to: new Date(anio - 1, 11, 31),
      },
    },
  ]
}

interface DateRangeFilterProps {
  value: DateRange | undefined
  onChange: (rango: DateRange | undefined) => void
  placeholder?: string
  className?: string
  /** Lado por el que se despliega el panel respecto del botón. */
  align?: "start" | "center" | "end"
  "aria-label"?: string
}

export function DateRangeFilter({
  value,
  onChange,
  placeholder = "Todas las fechas",
  className,
  align = "start",
  "aria-label": ariaLabel = "Filtrar por rango de fechas",
}: DateRangeFilterProps) {
  const [abierto, setAbierto] = useState(false)
  const hayRango = Boolean(value?.from || value?.to)

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            "justify-start font-normal",
            !hayRango && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4 opacity-60" />
          <span className="truncate">{etiqueta(value, placeholder)}</span>
          {hayRango && (
            // `span` y no `button`: anidar un botón dentro del trigger es HTML
            // inválido y el clic terminaría abriendo el panel igual.
            <span
              role="button"
              tabIndex={0}
              aria-label="Quitar el filtro de fechas"
              className="ml-auto rounded-sm opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return
                e.preventDefault()
                e.stopPropagation()
                onChange(undefined)
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-row gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
            {atajos().map((atajo) => (
              <Button
                key={atajo.nombre}
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-xs font-normal"
                onClick={() => {
                  onChange(atajo.rango)
                  setAbierto(false)
                }}
              >
                {atajo.nombre}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start text-xs font-normal text-muted-foreground"
              onClick={() => {
                onChange(undefined)
                setAbierto(false)
              }}
              disabled={!hayRango}
            >
              Limpiar
            </Button>
          </div>

          {/*
            El panel NO se cierra solo al elegir, igual que el Range Picker de
            shadcn: se cierra haciendo clic afuera o con Esc.

            Cerrarlo al completar el rango parece buena idea y no lo es: en
            react-day-picker v9 el PRIMER clic ya devuelve `{from: X, to: X}`
            —los dos extremos en el mismo día— así que la condición se cumple
            enseguida y el panel se cierra antes de poder elegir el segundo día.
          */}
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
