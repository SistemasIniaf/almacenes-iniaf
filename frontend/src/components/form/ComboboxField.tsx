import { useState } from "react"
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
}: ComboboxFieldProps<T>) {
  const [abierto, setAbierto] = useState(false)
  const fieldId = id || `field-${name}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const seleccionada = options.find(
          (opcion) => opcion.value === field.value
        )

        return (
          <Field data-invalid={fieldState.invalid} className="gap-2">
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <span className="text-red-500">*</span>}
            </FieldLabel>
            {description && (
              <p className="mb-2 text-sm text-muted-foreground">
                {description}
              </p>
            )}

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
                    {seleccionada ? seleccionada.label : placeholder}
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
                  <CommandList>
                    <CommandEmpty>{vacio}</CommandEmpty>
                    <CommandGroup>
                      {options.map((opcion) => (
                        <CommandItem
                          key={opcion.value}
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
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{opcion.label}</span>
                            {opcion.descripcion && (
                              <span className="truncate text-xs text-muted-foreground">
                                {opcion.descripcion}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
