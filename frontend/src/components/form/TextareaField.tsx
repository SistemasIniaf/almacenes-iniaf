import { Controller } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

import type { Control, FieldValues, Path } from "react-hook-form"

interface TextareaFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  placeholder?: string
  id?: string
  rows?: number
  className?: string
  maxLength?: number
  disabled?: boolean
  description?: string
  required?: boolean
}

export function TextareaField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  id,
  rows,
  className,
  maxLength,
  disabled = false,
  description,
  required = true,
}: TextareaFieldProps<T>) {
  const fieldId = id || `field-${name}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <span className="ml-1 text-red-500">*</span>}
            </FieldLabel>
            {description && (
              <p className="mb-2 text-sm text-muted-foreground">
                {description}
              </p>
            )}

            <Textarea
              {...field}
              id={fieldId}
              rows={rows}
              aria-invalid={fieldState.invalid}
              placeholder={placeholder}
              className={cn(className)}
              disabled={disabled}
              maxLength={maxLength}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
