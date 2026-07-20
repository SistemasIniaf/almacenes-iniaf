import { Controller } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select"

import type { Control, FieldValues, Path } from "react-hook-form"

export interface SelectOption {
  value: string
  label: string
}

export interface SelectOptionGroup {
  type: "separator"
}

export type SelectOptionOrSeparator = SelectOption | SelectOptionGroup

interface SelectFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  options: SelectOptionOrSeparator[]
  placeholder?: string
  id?: string
  description?: string
  orientation?: "vertical" | "horizontal" | "responsive"
  triggerClassName?: string
  disabled?: boolean
  defaultOption?: SelectOption
  required?: boolean
  /** Clases extra para el contenedor (ej. `sm:col-span-2` en formularios en grid). */
  className?: string
}

export function SelectField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Select",
  options,
  id,
  description,
  orientation = "vertical",
  triggerClassName,
  disabled = false,
  defaultOption,
  required = true,
  className,
}: SelectFieldProps<T>) {
  const fieldId = id || `field-${name}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field
          orientation={orientation}
          data-invalid={fieldState.invalid}
          className={cn("gap-2", className)}
        >
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          <Select
            name={field.name}
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={fieldId}
              aria-invalid={fieldState.invalid}
              className={cn(triggerClassName)}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>

            <SelectContent position="popper">
              {defaultOption && (
                <>
                  <SelectItem value={defaultOption.value}>
                    {defaultOption.label}
                  </SelectItem>
                  <SelectSeparator />
                </>
              )}

              {options.map((option, index) => {
                if ("type" in option && option.type === "separator") {
                  return <SelectSeparator key={`separator-${index}`} />
                }

                const selectOption = option as SelectOption
                return (
                  <SelectItem
                    key={selectOption.value}
                    value={selectOption.value}
                  >
                    {selectOption.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
