import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"

import type { Control, FieldValues, Path } from "react-hook-form"

interface InputFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  placeholder?: string
  id?: string
  type?: string
  autoComplete?: string
  disabled?: boolean
  readOnly?: boolean
  description?: string
  required?: boolean
  /**
   * Fuerza el valor a MAYÚSCULAS mientras se escribe. Convierte el valor REAL
   * del formulario, no solo lo que se ve: el `text-transform` de CSS es puro
   * maquillaje y enviaría minúsculas al backend.
   *
   * **Viene encendido** para `type="text"` (2026-08-07, pedido del usuario): así
   * figuran los datos en los documentos oficiales de la institución y la carga
   * queda uniforme sin depender de quién tipea. Se apaga sola en cualquier otro
   * `type` (password, email, tel…), donde cambiar el valor sería un error.
   *
   * Pasala en `false` cuando el valor NO es un dato de documento sino un
   * identificador técnico. Hoy el único caso es el **nombre de usuario**, que el
   * backend compara exacto (`findUnique`): forzarlo rompería todos los accesos.
   */
  mayusculas?: boolean
  /** Clases extra para el contenedor (ej. `sm:col-span-2` en formularios en grid). */
  className?: string
}

export function InputField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  id,
  type = "text",
  autoComplete = "off",
  disabled = false,
  readOnly = false,
  description,
  required = true,
  mayusculas,
  className,
}: InputFieldProps<T>) {
  const fieldId = id || `field-${name}`
  // Solo el texto libre. Atarlo al `type` y no a un simple `?? true` evita que
  // un campo nuevo con otro tipo lo herede sin que nadie lo haya decidido.
  const enMayusculas = mayusculas ?? type === "text"

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          className={cn("gap-2", className)}
        >
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <span className="text-red-500">*</span>}
          </FieldLabel>
          <Input
            {...field}
            id={fieldId}
            type={type}
            aria-invalid={fieldState.invalid}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            readOnly={readOnly}
            value={field.value ?? ""}
            onChange={
              enMayusculas
                ? (evento) =>
                    field.onChange(evento.target.value.toLocaleUpperCase())
                : field.onChange
            }
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
