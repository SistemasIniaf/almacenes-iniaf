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
  className,
}: InputFieldProps<T>) {
  const fieldId = id || `field-${name}`

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
