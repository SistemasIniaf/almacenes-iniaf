import { useState } from "react"
import { Controller } from "react-hook-form"
import { Eye, EyeOff } from "lucide-react"

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

          {description && (
            <p className="mb-2 text-sm text-muted-foreground">{description}</p>
          )}

          <div className="relative">
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
              className="pr-10"
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

          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
