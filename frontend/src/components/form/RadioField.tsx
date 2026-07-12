import { Controller } from "react-hook-form"

import { cn } from "@/lib/utils"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

import type { Control, FieldValues, Path } from "react-hook-form"

export interface RadioOption {
  value: string
  label: string
  description?: string
}

interface RadioFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  options: RadioOption[]
  description?: string
  disabled?: boolean
  className?: string
  orientation?: "vertical" | "horizontal"
  required?: boolean
}

export function RadioField<T extends FieldValues>({
  name,
  control,
  label,
  options,
  description,
  disabled = false,
  className,
  orientation = "vertical",
  required = true,
}: RadioFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          <FieldLabel>
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {description && (
            <p className="mb-3 text-sm text-muted-foreground">{description}</p>
          )}

          <RadioGroup
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={disabled}
            className={cn(
              orientation === "horizontal" && "flex flex-wrap gap-4"
            )}
          >
            {options.map((option) => {
              const radioId = `${name}-${option.value}`

              return (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={option.value}
                    id={radioId}
                    aria-invalid={fieldState.invalid}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={radioId}
                      className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {option.label}
                    </label>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </RadioGroup>

          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
