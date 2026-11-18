import { useState } from "react"
import { Controller } from "react-hook-form"
import { Eye, EyeOff } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

import type { Control, FieldValues, Path } from "react-hook-form"

interface InputPasswordFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  placeholder?: string
  id?: string
  autoComplete?: string
  disabled?: boolean
  readOnly?: boolean
  description?: string
  required?: boolean
  /**
   * Ícono DENTRO del campo, a la izquierda (2026-11-18, pedido del usuario para
   * el login). Es decorativo: el rótulo sigue siendo el que nombra el campo.
   */
  icono?: LucideIcon
}

export function InputPasswordField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  id,
  autoComplete = "off",
  disabled = false,
  readOnly = false,
  description,
  required = true,
  icono: Icono,
}: InputPasswordFieldProps<T>) {
  const [showPassword, setShowPassword] = useState(false)
  const fieldId = id || `field-${name}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-2">
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <span className="text-red-500">*</span>}
          </FieldLabel>

          <div className="relative">
            {Icono && (
              <Icono
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
            )}
            <Input
              {...field}
              id={fieldId}
              type={showPassword ? "text" : "password"}
              aria-invalid={fieldState.invalid}
              placeholder={placeholder}
              autoComplete={autoComplete}
              disabled={disabled}
              readOnly={readOnly}
              value={field.value ?? ""}
              className={Icono ? "pr-10 pl-9" : "pr-10"}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
