import { useFieldArray, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ComboboxField } from "@/components/form/ComboboxField"
import { NumberField } from "@/components/form/NumberField"
import { useItemsActivos } from "@/features/ingresos/hooks/useIngresos"

import type { Control, Path } from "react-hook-form"
import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"

interface IngresoLineasProps {
  control: Control<IngresoFormValues>
  disabled?: boolean
}

const moneda = (n: number) =>
  n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function IngresoLineas({ control, disabled }: IngresoLineasProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "detalles" })
  const { data: items = [], isLoading } = useItemsActivos()

  // Para el total en vivo por línea y general.
  const detalles = useWatch({ control, name: "detalles" }) ?? []

  const opciones = items.map((i) => ({
    value: String(i.id),
    label: `${i.codigo} — ${i.descripcion}`,
    busqueda: i.codigo,
  }))

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
              append({ itemId: "", cantidad: "", precioUnitario: "" })
            }
          >
            <Plus className="size-4" />
            Agregar ítem
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          Sin ítems todavía. {disabled ? "" : "Agregá al menos uno para confirmar."}
        </p>
      )}

      {fields.map((campo, index) => {
        const linea = detalles[index]
        const subtotal =
          (Number(linea?.cantidad) || 0) * (Number(linea?.precioUnitario) || 0)
        return (
          <div
            key={campo.id}
            className="grid grid-cols-1 items-start gap-2 rounded-md border p-3 sm:grid-cols-[1fr_7rem_8rem_auto]"
          >
            <ComboboxField
              name={`detalles.${index}.itemId` as Path<IngresoFormValues>}
              label="Ítem"
              control={control}
              options={opciones}
              placeholder={isLoading ? "Cargando..." : "Elegí un ítem"}
              vacio="Ningún ítem coincide."
              disabled={disabled}
            />
            <NumberField
              name={`detalles.${index}.cantidad` as Path<IngresoFormValues>}
              label="Cantidad"
              control={control}
              step="0.01"
              min={0}
              placeholder="0"
              disabled={disabled}
            />
            <NumberField
              name={
                `detalles.${index}.precioUnitario` as Path<IngresoFormValues>
              }
              label="Precio unit."
              control={control}
              step="0.00001"
              min={0}
              placeholder="0.00"
              disabled={disabled}
            />
            <div className="flex flex-col gap-1 sm:items-end">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium tabular-nums">
                {moneda(subtotal)}
              </span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(index)}
                  aria-label="Quitar ítem"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}

      {fields.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Total del ingreso:</span>
          <span className="text-base font-semibold tabular-nums">
            Bs {moneda(totalGeneral)}
          </span>
        </div>
      )}
    </div>
  )
}
