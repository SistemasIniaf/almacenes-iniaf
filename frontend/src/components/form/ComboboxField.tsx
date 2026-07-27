import { useCallback, useEffect, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import type { ReactNode } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"

export interface ComboboxOption {
  value: string
  label: string
  /** Texto adicional que se muestra en gris debajo (ej. la denominación). */
  descripcion?: string
  /** Texto extra por el que también se puede buscar (ej. el código). */
  busqueda?: string
}

interface ComboboxFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  options: ComboboxOption[]
  placeholder?: string
  vacio?: string
  id?: string
  description?: string
  disabled?: boolean
  required?: boolean
  className?: string
  /** Texto del cuadro de búsqueda de la lista. */
  buscarPlaceholder?: string
  /**
   * Búsqueda contra el SERVIDOR. Si viene, cmdk deja de filtrar en memoria y
   * `options` se toma tal cual llega (el que consume decide qué trae cada
   * término). Se usa para catálogos que no entran en el navegador (ítems).
   */
  onSearchChange?: (valor: string) => void
  /** Término actual, cuando la búsqueda es contra el servidor (controlado). */
  search?: string
  /** Muestra "Buscando..." mientras la consulta está en vuelo. */
  loading?: boolean
  /** Pie de la lista (ej. "mostrando 50 de 23.005"). */
  footer?: ReactNode
  /**
   * Avisa qué opción se eligió (además del `onChange` del formulario, que solo
   * lleva el value). Sirve con búsqueda del servidor, donde quien consume
   * necesita recordar el registro elegido: la lista de opciones cambia con cada
   * término y el seleccionado puede dejar de estar en ella.
   */
  onSelectOption?: (opcion: ComboboxOption) => void
  /**
   * Se llama al acercarse al final de la lista, para cargar la tanda siguiente
   * (catálogos grandes). Puede dispararse varias veces: quien lo implementa
   * debe ignorar el pedido si ya está trayendo o si no queda nada.
   */
  onEndReached?: () => void
}

/**
 * Selector con buscador para listas largas donde un `<select>` no escala
 * (partidas del clasificador, catalogo de items — ver CLAUDE.md).
 *
 * El valor se maneja como string, igual que `SelectField`, para que el
 * formulario lo convierta a number al armar el payload.
 */
export function ComboboxField<T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = "Seleccioná una opción",
  vacio = "Sin resultados.",
  id,
  description,
  disabled = false,
  required = true,
  className,
  buscarPlaceholder = "Buscar...",
  onSearchChange,
  search,
  loading = false,
  footer,
  onSelectOption,
  onEndReached,
}: ComboboxFieldProps<T>) {
  // Con búsqueda del servidor el filtrado ya lo hizo la API: cmdk no debe
  // volver a filtrar (si no, esconde resultados que el backend sí encontró,
  // ej. buscar por una palabra que está en la descripción pero no en la etiqueta).
  const enServidor = onSearchChange != null
  const [abierto, setAbierto] = useState(false)
  // Valor "activo" de cmdk (el resaltado por teclado). Al abrir se apunta al
  // item seleccionado, si no cmdk resalta el primero por defecto.
  const [resaltado, setResaltado] = useState("")
  const fieldId = id || `field-${name}`
  const limpiarWheel = useRef<(() => void) | null>(null)
  // El nodo de la lista se guarda en estado (no en un ref) para poder scrollearlo
  // desde un efecto: leer un ref en render lo prohíbe el lint del repo.
  const [nodoLista, setNodoLista] = useState<HTMLDivElement | null>(null)

  // La lista vuelve arriba cuando cambia el término. Si quedara al fondo, el
  // `onEndReached` se dispararía solo con los resultados nuevos y encadenaría
  // tandas que nadie pidió.
  //
  // Dos disparadores, porque ocurren en momentos distintos: `search` es lo que
  // se tipea (inmediato) y `primeraOpcion` avisa cuando el resultado REEMPLAZA
  // al anterior, que con búsqueda del servidor llega ~300 ms después. Cargar la
  // tanda siguiente NO lo dispara: eso agrega al final y deja la primera igual.
  const primeraOpcion = options[0]?.value
  useEffect(() => {
    // `scrollTo` y no `scrollTop = 0`: asignarle una propiedad a un valor que
    // viene de useState lo marca el lint como mutación de estado.
    nodoLista?.scrollTo({ top: 0 })
  }, [search, primeraOpcion, nodoLista])

  // Texto interno (cmdk) de cada opción, el mismo que se usa como `value` del item.
  const textoCmdk = (o: ComboboxOption) =>
    `${o.busqueda ?? ""} ${o.label} ${o.descripcion ?? ""}`

  // Dentro de un Dialog, el popover se portaliza a `body`, fuera del bloqueo de
  // scroll (`react-remove-scroll`) del diálogo: la barra funciona pero la rueda
  // del mouse no desplaza la lista. Se engancha un listener `wheel` NATIVO
  // no-pasivo directo sobre la lista al montarse (callback ref: corre justo
  // cuando el nodo existe, sin timing). React marca su `onWheel` como passive y
  // ahí `preventDefault` no corre; hacerlo nosotros evita también el
  // doble-scroll fuera de un diálogo.
  const refLista = useCallback((lista: HTMLDivElement | null) => {
    limpiarWheel.current?.()
    limpiarWheel.current = null
    setNodoLista(lista)
    if (!lista) return
    const onWheel = (evento: WheelEvent) => {
      evento.preventDefault()
      // `deltaMode`: 0 = píxeles, 1 = líneas (Firefox suele reportar ~3 por
      // muesca), 2 = páginas. Sin escalar, en líneas el scroll es imperceptible.
      const factor =
        evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? lista.clientHeight : 1
      lista.scrollTop += evento.deltaY * factor
    }
    lista.addEventListener("wheel", onWheel, { passive: false })
    limpiarWheel.current = () =>
      lista.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const seleccionada = options.find(
          (opcion) => opcion.value === field.value
        )

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn("gap-2", className)}
          >
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <span className="text-red-500">*</span>}
            </FieldLabel>
            <Popover
              open={abierto}
              onOpenChange={(nuevo) => {
                // Al abrir, el resaltado arranca sobre la opción ya elegida.
                if (nuevo) setResaltado(seleccionada ? textoCmdk(seleccionada) : "")
                // Al cerrar se limpia el término, para que la próxima apertura
                // no arranque con la búsqueda de la vez anterior.
                else onSearchChange?.("")
                setAbierto(nuevo)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  id={fieldId}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={abierto}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="w-full justify-between font-normal"
                >
                  <span
                    className={cn(
                      "truncate",
                      !seleccionada && "text-muted-foreground"
                    )}
                  >
                    {seleccionada
                      ? seleccionada.descripcion
                        ? `${seleccionada.label} — ${seleccionada.descripcion}`
                        : seleccionada.label
                      : placeholder}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                <Command
                  value={resaltado}
                  onValueChange={setResaltado}
                  shouldFilter={!enServidor}
                  filter={(value, termino) => {
                    // `value` es el texto de busqueda que arma cada item abajo.
                    const normalizar = (texto: string) =>
                      texto
                        .normalize("NFD")
                        .replace(/\p{Diacritic}/gu, "")
                        .toLowerCase()
                    return normalizar(value).includes(normalizar(termino))
                      ? 1
                      : 0
                  }}
                >
                  <CommandInput
                    placeholder={buscarPlaceholder}
                    value={enServidor ? (search ?? "") : undefined}
                    onValueChange={onSearchChange}
                  />
                  <CommandList
                    ref={refLista}
                    // `onScroll` de React alcanza acá (no necesita ser no-pasivo
                    // como el `wheel` de arriba, que sí llama a preventDefault) y
                    // se dispara también con el scroll que hace ese handler.
                    onScroll={(evento) => {
                      if (!onEndReached) return
                      const lista = evento.currentTarget
                      const faltante =
                        lista.scrollHeight - lista.scrollTop - lista.clientHeight
                      // Un par de filas antes del fondo, para que la tanda llegue
                      // sin que el scroll se frene.
                      if (faltante < 64) onEndReached()
                    }}
                  >
                    <CommandEmpty>
                      {loading ? "Buscando..." : vacio}
                    </CommandEmpty>
                    {loading && options.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Buscando...
                      </div>
                    )}
                    <CommandGroup>
                      {options.map((opcion) => (
                        <CommandItem
                          key={opcion.value}
                          // `group/opcion` permite que la descripcion (muted)
                          // cambie de color cuando la fila queda resaltada, si no
                          // se pierde sobre el fondo de seleccion.
                          className="group/opcion"
                          // cmdk busca sobre este string, no sobre el JSX.
                          value={textoCmdk(opcion)}
                          onSelect={() => {
                            field.onChange(opcion.value)
                            onSelectOption?.(opcion)
                            setAbierto(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              opcion.value === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 truncate">
                            {opcion.label}
                            {opcion.descripcion && (
                              <span className="text-muted-foreground group-data-[selected=true]/opcion:text-accent-foreground">
                                {" "}
                                — {opcion.descripcion}
                              </span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  {/* Fuera de CommandList a propósito: adentro scrollea con las
                      opciones y solo se ve al llegar al fondo, que es justo
                      cuando deja de importar. Acá queda fijo al pie del popover. */}
                  {footer && (
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                      {footer}
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>

            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
