import { useState } from "react"
import { useFieldArray, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { ComboboxField } from "@/components/form/ComboboxField"
import { InputField } from "@/components/form/InputField"
import { NumberField } from "@/components/form/NumberField"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  ITEMS_POR_BUSQUEDA,
  useBuscarLotes,
} from "@/features/egresos/hooks/useBuscarLotes"
import { LINEA_VACIA } from "@/features/egresos/egresos.schema"

import type { Control } from "react-hook-form"
import type { ComboboxOption } from "@/components/form/ComboboxField"
import type { EgresoFormValues } from "@/features/egresos/egresos.schema"
import type { LoteElegible } from "@/features/egresos/hooks/useBuscarLotes"

interface EgresoLineasProps {
  control: Control<EgresoFormValues>
  disabled?: boolean
  /**
   * Lotes que el pedido ya referencia al abrirlo. Hacen falta porque la lista
   * del combo es una búsqueda del servidor: sin ellos, un lote ya elegido que no
   * esté en los resultados actuales se mostraría en blanco. Y además un lote
   * pedido puede haber quedado sin disponible justamente porque ESTE pedido lo
   * reservó.
   */
  lotesIniciales?: LoteElegible[]
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-BO")

/**
 * Etiqueta del lote. Lleva lo mismo que el selector del sistema anterior
 * (fecha, descripción, saldo y fuente) porque es lo que el solicitante necesita
 * para decidir de qué compra sacar el material — pero muestra el DISPONIBLE, no
 * el saldo, y los agotados directamente no se ofrecen.
 */
const aOpcion = (l: LoteElegible): ComboboxOption => ({
  value: String(l.id),
  label: `${l.itemDescripcion} — disp. ${l.disponible} ${l.unidadMedida}`,
  descripcion: `${l.fuente} · ingreso ${l.numeroIngreso} · ${fecha(l.fechaIngreso)}`,
  busqueda: l.itemCodigo,
})

export function EgresoLineas({
  control,
  disabled,
  lotesIniciales = [],
}: EgresoLineasProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "detalles",
  })

  const [termino, setTermino] = useState("")
  const terminoDiferido = useDebouncedValue(termino)
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useBuscarLotes(terminoDiferido)

  // Lo elegido en ESTA sesión se recuerda al elegirlo (no en un efecto: el lint
  // del repo rechaza setState dentro de useEffect). Si no, cambiar el término
  // dejaría sin etiqueta a un lote ya seleccionado.
  const [vistos, setVistos] = useState<LoteElegible[]>([])
  const encontrados = data?.lotes ?? []

  const porId = new Map<number, LoteElegible>()
  for (const l of [...lotesIniciales, ...vistos, ...encontrados]) {
    porId.set(l.id, l)
  }
  const opciones = [...porId.values()].map(aOpcion)

  const lineas = useWatch({ control, name: "detalles" })

  function cargarMas() {
    // No se pide otra tanda mientras hay una en vuelo: si no, acercarse al final
    // encadena pedidos que nadie hizo.
    if (hasNextPage && !isFetching) void fetchNextPage()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <FieldLabel>
          Ítems del pedido<span className="text-red-500">*</span>
        </FieldLabel>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...LINEA_VACIA })}
          >
            <Plus className="size-4" />
            Agregar ítem
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no agregaste ítems. Cada línea sale de un lote concreto: elegís
          de qué compra y de qué fuente se descuenta el material.
        </p>
      )}

      {fields.map((field, indice) => {
        const elegido = lineas?.[indice]?.ingresoDetalleId
        const lote = elegido ? porId.get(Number(elegido)) : undefined

        return (
          <div key={field.id} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <ComboboxField
                  name={`detalles.${indice}.ingresoDetalleId`}
                  label="Lote"
                  control={control}
                  disabled={disabled}
                  options={opciones}
                  placeholder="Buscá el ítem y elegí de qué lote sale"
                  vacio="Ningún lote con disponible coincide."
                  buscarPlaceholder="Buscar por código o descripción..."
                  search={termino}
                  onSearchChange={setTermino}
                  loading={isFetching}
                  onSelectOption={(opcion) => {
                    const encontrado = encontrados.find(
                      (l) => String(l.id) === opcion.value
                    )
                    if (encontrado) setVistos((previos) => [...previos, encontrado])
                  }}
                  onEndReached={cargarMas}
                  footer={
                    hasNextPage
                      ? `Mostrando ${encontrados.length} — scrolleá para ver más`
                      : undefined
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <NumberField
                  name={`detalles.${indice}.cantidadSolicitada`}
                  label="Cantidad"
                  control={control}
                  disabled={disabled}
                  step="0.01"
                  min={0}
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <p className="pb-2 text-xs text-muted-foreground">
                  {lote
                    ? `Disponible: ${lote.disponible} ${lote.unidadMedida}`
                    : "—"}
                </p>
              </div>

              {!disabled && (
                <div className="flex items-end justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(indice)}
                    aria-label="Quitar ítem"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}

              <div className="sm:col-span-12">
                <InputField
                  name={`detalles.${indice}.observacion`}
                  label="Observación"
                  control={control}
                  required={false}
                  disabled={disabled}
                  placeholder="Opcional: aclaración de esta línea"
                />
              </div>
            </div>
          </div>
        )
      })}

      {fields.length > 0 && encontrados.length >= ITEMS_POR_BUSQUEDA && (
        <p className="text-xs text-muted-foreground">
          Si no encontrás un ítem, escribí parte de su código o descripción: la
          búsqueda va contra el servidor.
        </p>
      )}
    </div>
  )
}
