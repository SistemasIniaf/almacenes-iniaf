import { useState } from "react"
import { Controller } from "react-hook-form"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import type { Control, FieldValues, Path } from "react-hook-form"

interface DatePickerFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  placeholder?: string
  description?: string
  disabled?: boolean
  required?: boolean
  className?: string
  buttonClassName?: string
  fromDate?: Date
  toDate?: Date
  captionLayout?:
    "label" | "dropdown" | "dropdown-months" | "dropdown-years" | undefined
}

export function DatePickerField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Select date",
  description,
  disabled = false,
  required = true,
  className,
  buttonClassName,
  fromDate,
  toDate,
  captionLayout = "dropdown",
}: DatePickerFieldProps<T>) {
  const [open, setOpen] = useState(false)

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
            <p className="mb-2 text-sm text-muted-foreground">{description}</p>
          )}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between font-normal",
                  !field.value && "text-muted-foreground",
                  buttonClassName
                )}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
              >
                {field.value ? field.value.toLocaleDateString() : placeholder}
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={(date: Date | undefined) => {
                  field.onChange(date)
                  setOpen(false)
                }}
                disabled={disabled}
                captionLayout={captionLayout}
                startMonth={fromDate}
                endMonth={toDate}
              />
            </PopoverContent>
          </Popover>

          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
