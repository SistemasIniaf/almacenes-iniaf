import { useState } from "react"
import { Controller, useFieldArray, useFormState, useWatch } from "react-hook-form"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { ComboboxField } from "@/components/form/ComboboxField"
import { ImageField } from "@/components/form/ImageField"
import { InputField } from "@/components/form/InputField"
import { NumberField } from "@/components/form/NumberField"
import { cn } from "@/lib/utils"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  ITEMS_POR_BUSQUEDA,
  useBuscarItems,
} from "@/features/items/useBuscarItems"
import { LINEA_VACIA } from "@/features/ingresos/ingresos.schema"

import type { Control, Path } from "react-hook-form"
import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"

/** Lo único que el selector necesita de un ítem. */
export interface ItemDeLinea {
  id: number
  codigo: string
  descripcion: string
  unidadMedida: string
}

/**
 * Manejo de la foto cuando el lote YA existe (ingreso registrado): la subida es
 * inmediata contra su endpoint, sin esperar a ningún submit.
 *
 * Al crear no se pasa: ahí las líneas todavía no tienen id, así que el archivo
 * se guarda en el campo `archivo` del formulario y se sube después del POST.
 */
export interface FotoDeLote {
  /** URL vigente del lote, ya con lo subido en esta sesión. */
  urlDe: (detalleId: number) => string | null
  onSubir: (detalleId: number, archivo: File) => void
  onQuitar: (detalleId: number) => void
  /** Lote cuya foto se está subiendo/borrando ahora mismo, si hay alguno. */
  enCurso: number | null
  /** La foto tampoco se puede tocar (ingreso anulado). */
  bloqueada: boolean
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
  /**
   * Presente solo al EDITAR. Su ausencia es lo que pone la foto en modo
   * "archivo pendiente" (creación).
   */
  foto?: FotoDeLote
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

/**
 * La foto del lote, en sus dos modos.
 *
 * Al **editar** el lote ya tiene id, así que la subida va directo a su endpoint
 * y se aplica al instante — igual que la foto de un ítem. Al **crear** todavía
 * no hay id (las líneas nacen dentro de la transacción del POST), así que el
 * archivo se guarda en el formulario y `IngresoFormPage` lo sube después.
 *
 * Es opcional a propósito: donde se muestra el material vale
 * `lote.imagenUrl ?? item.imagenUrl`, así que un lote sin foto propia sigue
 * mostrando la del catálogo. Solo hace falta fotografiar cuando ESTA compra se
 * ve distinta de lo que dice el catálogo (otra marca, otro color) — que es
 * cuando además se llena la observación.
 */
function FotoDeLinea({
  control,
  index,
  detalleId,
  disabled,
  foto,
}: {
  control: Control<IngresoFormValues>
  index: number
  detalleId: string
  disabled?: boolean
  foto?: FotoDeLote
}) {
  if (foto && detalleId) {
    const id = Number(detalleId)
    return (
      <ImageField
        label="Foto del lote (opcional)"
        imagenUrl={foto.urlDe(id)}
        procesando={foto.enCurso === id}
        // NO usa `disabled` de la línea: con el ingreso ya registrado el resto
        // queda congelado, pero la foto se puede cargar o cambiar igual — no
        // mueve saldo ni correlativo. Solo la frena un ingreso anulado.
        disabled={foto.bloqueada}
        onSeleccionar={(archivo) => foto.onSubir(id, archivo)}
        onQuitar={() => foto.onQuitar(id)}
      />
    )
  }

  return (
    <Controller
      control={control}
      name={`detalles.${index}.archivo` as Path<IngresoFormValues>}
      render={({ field }) => (
        <ImageField
          label="Foto del lote (opcional)"
          imagenUrl={null}
          archivoPendiente={field.value as File | null}
          disabled={disabled}
          onSeleccionar={(archivo) => field.onChange(archivo)}
          onQuitar={() => field.onChange(null)}
        />
      )}
    />
  )
}

export function IngresoLineas({
  control,
  disabled,
  itemsIniciales = [],
  foto,
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

  // Error a nivel del arreglo (ej. "Agregá al menos un ítem"): no lo pinta ningún
  // campo, así que se muestra acá. Al ser un field array, RHF lo deja en `.root`.
  const { errors } = useFormState({ control, name: "detalles" })
  const errorDetalles = errors.detalles as
    | { message?: string; root?: { message?: string } }
    | undefined
  const mensajeDetalles = errorDetalles?.root?.message ?? errorDetalles?.message

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
      {/* Encabezado con peso propio: esto no es un campo más de la cabecera, es
          el contenido del ingreso. El contador va al lado porque es el dato que
          se chequea de un vistazo antes de registrar. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">Ítems del ingreso</span>
        {fields.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
            {fields.length} {fields.length === 1 ? "ítem" : "ítems"}
          </span>
        )}
      </div>

      {mensajeDetalles && (
        <p className="text-sm text-destructive">{mensajeDetalles}</p>
      )}

      {fields.length === 0 && (
        <p
          className={cn(
            "text-center text-sm text-muted-foreground",
            mensajeDetalles && "text-destructive"
          )}
        >
          Sin ítems todavía.{" "}
          {disabled ? "" : "Agregá al menos uno para registrar el ingreso."}
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
            // `bg-card`: la sección entera va sobre un panel tintado, así que
            // cada línea necesita superficie propia para leerse como una ficha.
            className="relative flex flex-col gap-2 rounded-md border bg-card p-3"
          >
            {/* Quitar la línea: «X» en la esquina de la tarjeta, igual que en
                egresos. Antes era un 🗑 dentro de la celda del Subtotal, lo que
                obligaba a descontar su ancho en el pie del Total. */}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(index)}
                aria-label="Quitar ítem"
              >
                <X className="size-4" />
              </Button>
            )}

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
              {/* Subtotal (derivado). El `pr-7` le deja lugar a la «X» de la
                  esquina, que cae justo sobre esta columna; el pie del Total
                  usa el mismo valor para quedar alineado con el monto. */}
              <div className="flex flex-col gap-2 lg:col-span-1 lg:pr-7">
                <FieldLabel className="lg:text-right">Subtotal</FieldLabel>
                <div className="flex h-9 items-center justify-end">
                  <span className="text-sm font-medium tabular-nums">
                    {moneda(subtotal)}
                  </span>
                </div>
              </div>
            </div>
            {/* Foto y Observación van en la MISMA fila porque dicen lo mismo:
                qué es exactamente ESTE lote (la marca, el color). Son lo único
                que distingue dos lotes del mismo ítem, que en el catálogo
                comparten descripción y foto. Arriba queda lo contable —ítem,
                cantidad, precio—, que es de otra naturaleza. */}
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              {/* Ancho FIJO. `Field` de shadcn trae `w-full`, así que sin acotarlo
                  el bloque de la foto se lleva casi toda la fila y la Observación
                  queda en una columna de ~100 px donde no entra ni «COLOR AZUL».
                  Los 320 px son lo que miden la miniatura (96) + los botones + el
                  texto de formatos, que es lo más ancho que hay adentro. */}
              <div className="w-full sm:w-80 sm:shrink-0">
                <FotoDeLinea
                  control={control}
                  index={index}
                  detalleId={linea?.detalleId ?? ""}
                  disabled={disabled}
                  foto={foto}
                />
              </div>
              {/* `min-w-0` para que el input pueda encogerse dentro del flex en
                  vez de desbordar la tarjeta. */}
              <div className="w-full min-w-0 flex-1">
                <InputField
                  name={
                    `detalles.${index}.observacion` as Path<IngresoFormValues>
                  }
                  label="Observación"
                  control={control}
                  required={false}
                  disabled={disabled}
                  placeholder="Marca, color… lo que distinga a este lote"
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* El botón va DEBAJO de las líneas y ocupa todo el ancho: es donde el ojo
          termina de leer la última fila y hacia dónde sigue el trabajo. Arriba a
          la derecha, en tamaño chico, se perdía contra el título. El borde
          punteado lo lee como «acá se agrega otra», no como una acción del
          formulario que compita con el submit.

          Las clases son LAS MISMAS que en `EgresoLineas`: los dos formularios de
          líneas tienen que verse hermanos, así que si cambia uno, cambian los dos. */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ...LINEA_VACIA })}
          className={cn(
            "h-11 w-full border-dashed border-primary/50 bg-primary/5 font-medium text-primary hover:border-primary hover:bg-primary/10 hover:text-primary",
            mensajeDetalles &&
              "border-destructive/60 bg-destructive/5 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      )}

      {/* Total: replica la grilla de 12 columnas para que el valor caiga bajo la
          columna Subtotal. El `pr-7` es el mismo que usa esa columna, para
          dejarle lugar a la «X» de la esquina y quedar bajo el monto de arriba. */}
      {fields.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t pt-3 text-sm lg:grid lg:grid-cols-12 lg:items-center lg:gap-2">
          <span className="font-medium lg:col-span-9 lg:text-right">
            Total del ingreso:
          </span>
          <span className="text-base font-semibold tabular-nums lg:col-span-3 lg:pr-7 lg:text-right">
            Bs {moneda(totalGeneral)}
          </span>
        </div>
      )}
    </div>
  )
}
