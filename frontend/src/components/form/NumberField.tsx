import { Controller } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { Control, FieldValues, Path } from "react-hook-form"

interface NumberFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label?: string
  placeholder?: string
  description?: string
  disabled?: boolean
  required?: boolean
  className?: string
  /** Paso del input (ej. "0.01" para 2 decimales). */
  step?: string
  min?: number
  /** Oculta el label (útil dentro de una tabla de líneas). */
  hideLabel?: boolean
}

/**
 * Campo numérico. El valor se maneja como STRING en el formulario (lo que
 * entrega un `<input>`); el schema Zod lo valida y la conversión a number ocurre
 * al armar el payload. Así se evita el lío de NaN al vaciar el campo.
 */
export function NumberField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  description,
  disabled = false,
  required = true,
  className,
  step = "any",
  min,
  hideLabel = false,
}: NumberFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          {label && !hideLabel && (
            <FieldLabel>
              {label}
              {required && <span className="ml-1 text-red-500">*</span>}
            </FieldLabel>
          )}
          <Input
            {...field}
            value={field.value ?? ""}
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-label={hideLabel ? label : undefined}
          />
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
