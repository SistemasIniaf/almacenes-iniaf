import { Controller } from "react-hook-form"

import {
  completarDecimales,
  numeroAInterno,
  numeroAPantalla,
} from "@/lib/formato"
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
  /** Oculta el label (útil dentro de una tabla de líneas). */
  hideLabel?: boolean
  /**
   * Al salir del campo completa hasta esta cantidad de decimales (`100` →
   * `100,00`), sin recortar los que ya tenga. Para importes y precios.
   */
  decimalesMinimos?: number
}

/**
 * Campo numérico. El valor se maneja como STRING en el formulario (lo que
 * entrega un `<input>`); el schema Zod lo valida y la conversión a number ocurre
 * al armar el payload. Así se evita el lío de NaN al vaciar el campo.
 *
 * **Se escribe con COMA decimal** (2026-11-17), como se muestran el subtotal, el
 * total y los reportes: con `type="number"` el navegador obligaba al punto y la
 * misma fila mostraba `25.00` al lado de `25,00`. Por eso es `type="text"`:
 * en pantalla va la coma, pero el valor del formulario sigue con PUNTO
 * (`numeroAInterno` de `lib/formato`), así el schema y el payload no cambian.
 * Tipear un punto también vale (el teclado numérico lo da): se convierte en coma.
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
  hideLabel = false,
  decimalesMinimos,
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
            value={numeroAPantalla(field.value)}
            onChange={(e) => field.onChange(numeroAInterno(e.target.value))}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-label={hideLabel ? label : undefined}
            onBlur={() => {
              if (decimalesMinimos != null && typeof field.value === "string") {
                const completo = completarDecimales(
                  field.value,
                  decimalesMinimos
                )
                if (completo !== field.value) field.onChange(completo)
              }
              field.onBlur()
            }}
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
