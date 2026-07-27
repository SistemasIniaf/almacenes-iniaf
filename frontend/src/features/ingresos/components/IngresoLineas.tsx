import { useFieldArray, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { ComboboxField } from "@/components/form/ComboboxField"
import { InputField } from "@/components/form/InputField"
import { NumberField } from "@/components/form/NumberField"
import { useItemsActivos } from "@/features/ingresos/hooks/useIngresos"

import type { Control, Path } from "react-hook-form"
import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"

interface IngresoLineasProps {
  control: Control<IngresoFormValues>
  disabled?: boolean
}

const moneda = (n: number) =>
  n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function IngresoLineas({ control, disabled }: IngresoLineasProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "detalles",
  })
  const { data: items = [], isLoading } = useItemsActivos()

  // Para el total en vivo por línea y general.
  const detalles = useWatch({ control, name: "detalles" }) ?? []

  const opciones = items.map((i) => ({
    value: String(i.id),
    label: `${i.codigo} — ${i.descripcion}`,
    busqueda: i.codigo,
  }))

  // Para mostrar la unidad de medida del ítem elegido en cada línea.
  const itemsPorId = new Map(items.map((i) => [String(i.id), i]))

  const totalGeneral = detalles.reduce(
    (s, d) => s + (Number(d?.cantidad) || 0) * (Number(d?.precioUnitario) || 0),
    0
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Ítems del ingreso</span>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                itemId: "",
                cantidad: "",
                precioUnitario: "",
                observacion: "",
              })
            }
          >
            <Plus className="size-4" />
            Agregar ítem
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          Sin ítems todavía.{" "}
          {disabled ? "" : "Agregá al menos uno para confirmar."}
        </p>
      )}

      {fields.map((campo, index) => {
        const linea = detalles[index]
        const subtotal =
          (Number(linea?.cantidad) || 0) * (Number(linea?.precioUnitario) || 0)
        const unidad = itemsPorId.get(linea?.itemId ?? "")?.unidadMedida
        return (
          <div
            key={campo.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            {/*
              Grilla de 12 columnas (desde sm). Anchos por campo vía col-span:
              Ítem 5 · Unidad 2 · Cantidad 1 · Precio 1 · Subtotal+Eliminar 3.
              El botón de quitar va DENTRO de la celda de Subtotal (no gasta
              columna propia). Ajustá estos números para redistribuir el espacio.
            */}
            <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-12">
              <ComboboxField
                name={`detalles.${index}.itemId` as Path<IngresoFormValues>}
                label="Ítem"
                control={control}
                options={opciones}
                placeholder={isLoading ? "Cargando..." : "Elegí un ítem"}
                vacio="Ningún ítem coincide."
                disabled={disabled}
                className="sm:col-span-7"
              />
              {/* Unidad de medida del ítem elegido (solo lectura, deriva del ítem). */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <FieldLabel>Unidad</FieldLabel>
                <div className="flex h-9 items-center rounded-md border bg-muted px-3">
                  <span className="truncate text-sm text-muted-foreground">
                    {unidad || "—"}
                  </span>
                </div>
              </div>

              <NumberField
                name={`detalles.${index}.cantidad` as Path<IngresoFormValues>}
                label="Cantidad"
                control={control}
                step="0.01"
                min={0}
                placeholder="0"
                disabled={disabled}
                className="sm:col-span-1"
              />

              <NumberField
                name={
                  `detalles.${index}.precioUnitario` as Path<IngresoFormValues>
                }
                label="Prec. unit."
                control={control}
                step="0.00001"
                min={0}
                placeholder="0.00"
                disabled={disabled}
                className="sm:col-span-1"
              />
              {/* Subtotal (derivado) + botón eliminar en la misma celda: el monto
                  alineado a la derecha y el 🗑 pegado a su lado, sin gastar una
                  columna solo para el icono. */}
              <div className="flex flex-col gap-2 sm:col-span-1">
                <FieldLabel className="sm:text-right">Subtotal</FieldLabel>
                <div className="flex h-9 items-center justify-end gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {moneda(subtotal)}
                  </span>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => remove(index)}
                      aria-label="Quitar ítem"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <InputField
              name={`detalles.${index}.observacion` as Path<IngresoFormValues>}
              label="Observación"
              control={control}
              required={false}
              disabled={disabled}
            />
          </div>
        )
      })}

      {/* Total: replica la grilla de 12 columnas para que el valor caiga bajo la
          columna Subtotal (col-span-3). El pr-11 lo desplaza a la izquierda el
          ancho del 🗑 (size-9 + gap-2) para quedar justo bajo el monto de arriba. */}
      {fields.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm sm:grid sm:grid-cols-12 sm:items-center sm:gap-2">
          <span className="text-muted-foreground sm:col-span-9 sm:text-right">
            Total del ingreso:
          </span>
          <span className="text-base font-semibold tabular-nums sm:col-span-3 sm:pr-11 sm:text-right">
            Bs {moneda(totalGeneral)}
          </span>
        </div>
      )}
    </div>
  )
}
