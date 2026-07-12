import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

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
}: InputFieldProps<T>) {
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
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
