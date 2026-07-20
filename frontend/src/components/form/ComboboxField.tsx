import { useCallback, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { Check, ChevronsUpDown } from "lucide-react"

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
}: ComboboxFieldProps<T>) {
  const [abierto, setAbierto] = useState(false)
  const fieldId = id || `field-${name}`
  const limpiarWheel = useRef<(() => void) | null>(null)

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
            <Popover open={abierto} onOpenChange={setAbierto}>
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
                  filter={(value, search) => {
                    // `value` es el texto de busqueda que arma cada item abajo.
                    const normalizar = (texto: string) =>
                      texto
                        .normalize("NFD")
                        .replace(/\p{Diacritic}/gu, "")
                        .toLowerCase()
                    return normalizar(value).includes(normalizar(search)) ? 1 : 0
                  }}
                >
                  <CommandInput placeholder="Buscar..." />
                  <CommandList ref={refLista}>
                    <CommandEmpty>{vacio}</CommandEmpty>
                    <CommandGroup>
                      {options.map((opcion) => (
                        <CommandItem
                          key={opcion.value}
                          // `group/opcion` permite que la descripcion (muted)
                          // cambie de color cuando la fila queda resaltada, si no
                          // se pierde sobre el fondo de seleccion.
                          className="group/opcion"
                          // cmdk busca sobre este string, no sobre el JSX.
                          value={`${opcion.busqueda ?? ""} ${opcion.label} ${opcion.descripcion ?? ""}`}
                          onSelect={() => {
                            field.onChange(opcion.value)
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
