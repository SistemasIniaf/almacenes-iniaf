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
  useBuscarItems,
} from "@/features/ingresos/hooks/useIngresos"

import type { Control, Path } from "react-hook-form"
import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"

/** Lo único que el selector necesita de un ítem. */
export interface ItemDeLinea {
  id: number
  codigo: string
  descripcion: string
  unidadMedida: string
}

interface IngresoLineasProps {
  control: Control<IngresoFormValues>
  disabled?: boolean
  /**
   * Ítems que ya trae el ingreso al abrirlo (de `ingreso.detalles`). Hacen falta
   * porque la lista del combo es una búsqueda del servidor: sin ellos, un ítem
   * ya elegido que no esté en los resultados actuales se mostraría en blanco.
   */
  itemsIniciales?: ItemDeLinea[]
}

const moneda = (n: number) =>
  n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const aOpcion = (i: ItemDeLinea) => ({
  value: String(i.id),
  label: `${i.codigo} — ${i.descripcion}`,
  busqueda: i.codigo,
})

export function IngresoLineas({
  control,
  disabled,
  itemsIniciales = [],
}: IngresoLineasProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "detalles",
  })

  // Búsqueda de ítems contra el servidor (el catálogo no entra en el navegador).
  // El término es uno solo para todo el bloque: solo hay un combo abierto a la
  // vez, y al cerrarse el `ComboboxField` lo limpia.
  const [busqueda, setBusqueda] = useState("")
  const termino = useDebouncedValue(busqueda, 300)
  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useBuscarItems(termino)
  const resultados = data?.pages.flatMap((p) => p.data) ?? []
  const totalCoincidencias = data?.pages[0]?.meta.total ?? 0

  const cargarMas = () => {
    // `isFetching` cubre también la búsqueda de un término nuevo: mientras esa
    // está en vuelo se sigue viendo la lista anterior, y pedir su tanda
    // siguiente traería resultados del término viejo.
    if (hasNextPage && !isFetching && !isFetchingNextPage) void fetchNextPage()
  }

  // Ítems elegidos en esta sesión del formulario. Hace falta recordarlos porque
  // al cerrar el combo el término se limpia y la lista pasa a ser otra: sin
  // esto, un ítem recién elegido se quedaría sin etiqueta ni unidad apenas
  // cambie la búsqueda. Se registran al elegir (evento), no al llegar los
  // resultados, que es cuando realmente importan.
  const [elegidos, setElegidos] = useState<Map<string, ItemDeLinea>>(
    () => new Map()
  )

  const porId = new Map(resultados.map((i) => [String(i.id), i]))
  const iniciales = new Map(itemsIniciales.map((i) => [String(i.id), i]))
  /** El ítem de una línea, venga de donde venga. */
  const dameItem = (id: string) =>
    porId.get(id) ?? iniciales.get(id) ?? elegidos.get(id)

  const recordarElegido = (id: string) => {
    const item = porId.get(id)
    if (!item) return
    setElegidos((previos) =>
      previos.has(id) ? previos : new Map(previos).set(id, item)
    )
  }

  // Para el total en vivo por línea y general.
  const detalles = useWatch({ control, name: "detalles" }) ?? []

  const opcionesBase = resultados.map(aOpcion)
  const cuenta = (n: number) => n.toLocaleString("es-BO")
  const pie = isFetchingNextPage
    ? "Cargando más ítems..."
    : totalCoincidencias > resultados.length
      ? `Viendo ${cuenta(resultados.length)} de ${cuenta(totalCoincidencias)} ítems. Seguí bajando para cargar más.`
      : totalCoincidencias > ITEMS_POR_BUSQUEDA
        ? `${cuenta(totalCoincidencias)} ítems.`
        : null

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
        const itemId = linea?.itemId ?? ""
        const elegido = dameItem(itemId)
        const unidad = elegido?.unidadMedida
        // El ítem ya elegido va siempre en la lista, aunque la búsqueda actual
        // no lo traiga: si no, el combo no tendría con qué pintar su etiqueta.
        const opciones =
          elegido && !resultados.some((i) => String(i.id) === itemId)
            ? [aOpcion(elegido), ...opcionesBase]
            : opcionesBase
        return (
          <div
            key={campo.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            {/*
              Grilla de 12 columnas DESDE lg. Antes arrancaba en sm y a 768 px los
              rotulos Cantidad/Prec.unit./Subtotal se pisaban entre si; en md
              van dos columnas y en movil apilado. Anchos por campo vía col-span:
              Ítem 5 · Unidad 2 · Cantidad 1 · Precio 1 · Subtotal+Eliminar 3.
              El botón de quitar va DENTRO de la celda de Subtotal (no gasta
              columna propia). Ajustá estos números para redistribuir el espacio.
            */}
            <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 lg:grid-cols-12">
              <ComboboxField
                name={`detalles.${index}.itemId` as Path<IngresoFormValues>}
                label="Ítem"
                control={control}
                options={opciones}
                placeholder="Elegí un ítem"
                vacio="Ningún ítem coincide."
                buscarPlaceholder="Buscar por código o descripción..."
                search={busqueda}
                onSearchChange={setBusqueda}
                onSelectOption={(opcion) => recordarElegido(opcion.value)}
                onEndReached={cargarMas}
                // Solo el "Buscando..." del término nuevo; la tanda siguiente
                // se avisa en el pie y no debe tapar la lista que ya está.
                loading={isFetching && !isFetchingNextPage}
                footer={pie}
                disabled={disabled}
                className="md:col-span-2 lg:col-span-7"
              />
              {/* Unidad de medida del ítem elegido (solo lectura, deriva del ítem). */}
              <div className="flex flex-col gap-2 lg:col-span-2">
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
                className="lg:col-span-1"
              />

              <NumberField
                name={
                  `detalles.${index}.precioUnitario` as Path<IngresoFormValues>
                }
                label="Prec.unit."
                control={control}
                step="0.00001"
                min={0}
                placeholder="0.00"
                disabled={disabled}
                className="lg:col-span-1"
              />
              {/* Subtotal (derivado) + botón eliminar en la misma celda: el monto
                  alineado a la derecha y el 🗑 pegado a su lado, sin gastar una
                  columna solo para el icono. */}
              <div className="flex flex-col gap-2 lg:col-span-1">
                <FieldLabel className="lg:text-right">Subtotal</FieldLabel>
                <div className="flex h-9 items-center justify-end">
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
        <div className="flex items-center justify-between gap-2 text-sm lg:grid lg:grid-cols-12 lg:items-center lg:gap-2">
          <span className="text-muted-foreground lg:col-span-9 lg:text-right">
            Total del ingreso:
          </span>
          <span className="text-base font-semibold tabular-nums lg:col-span-3 lg:pr-11 lg:text-right">
            Bs {moneda(totalGeneral)}
          </span>
        </div>
      )}
    </div>
  )
}
