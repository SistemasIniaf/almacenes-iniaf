import { Controller } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError } from "@/components/ui/field"

import type { Control, FieldValues, Path } from "react-hook-form"

interface CheckboxFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  id?: string
  description?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export function CheckboxField<T extends FieldValues>({
  name,
  control,
  label,
  id,
  description,
  disabled = false,
  required = true,
  className,
}: CheckboxFieldProps<T>) {
  const fieldId = id || `field-${name}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          <div className="flex items-start space-x-3">
            <Checkbox
              id={fieldId}
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor={fieldId}
                className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
              </label>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
