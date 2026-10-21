import { useState } from "react"
import { useFieldArray, useFormState, useWatch } from "react-hook-form"
import { ImageOff, Plus, X } from "lucide-react"

import { AvisoImagenReferencial } from "@/components/data/AvisoImagenReferencial"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldLabel } from "@/components/ui/field"
import { ComboboxField } from "@/components/form/ComboboxField"
import { InputField } from "@/components/form/InputField"
import { NumberField } from "@/components/form/NumberField"
import { urlArchivo } from "@/lib/files"
import { BOTON_AGREGAR_LINEA, BOTON_AGREGAR_LINEA_ERROR, cn } from "@/lib/utils"
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
  /** Foto de catálogo (ruta relativa) o null. */
  imagenUrl: string | null
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
  // Miniatura en la lista: ayuda a ubicar el ítem entre descripciones
  // parecidas antes de elegirlo.
  imagen: urlArchivo(i.imagenUrl),
})

/**
 * Foto de catálogo del ítem elegido, ampliable al hacer clic. Es solo una
 * REFERENCIA para confirmar que se eligió el material correcto: el ingreso no
 * guarda foto propia (se quitó el 2026-10-20, solo el ítem la lleva) y acá no
 * se puede cambiar — se carga desde el catálogo de Ítems.
 *
 * Sin ítem o sin foto muestra un marco vacío del mismo tamaño, para que la fila
 * no cambie de alto al elegir.
 *
 * Desde `lg` ocupa las DOS filas de la línea (campos + Observación): ancho fijo
 * de 112 px y `self-stretch`, así su alto es exactamente el de las dos filas
 * (64 + 8 + 36: la Observación lleva el rótulo al costado para que la línea no
 * quede tan alta) sin calcularlo. Por debajo de `lg` los campos se apilan y la
 * columna derecha crece mucho, así que ahí queda en un cuadrado de 96 px en vez
 * de estirarse.
 */
function FotoItem({ item }: { item?: ItemDeLinea }) {
  const [ampliada, setAmpliada] = useState(false)
  const src = urlArchivo(item?.imagenUrl)

  if (!item || !src) {
    return (
      <span className="flex size-24 shrink-0 items-center justify-center rounded border border-dashed bg-muted/40 lg:h-auto lg:w-28 lg:self-stretch">
        <ImageOff className="size-5 text-muted-foreground/60" />
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        className="relative flex size-24 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-white p-0.5 transition-opacity hover:opacity-80 lg:h-auto lg:w-28 lg:self-stretch"
        aria-label={`Ver imagen de ${item.descripcion}`}
        title="Imagen referencial del catálogo. Clic para ampliar."
      >
        <img
          src={src}
          alt={item.descripcion}
          className="max-h-full max-w-full object-contain"
        />
        {/* Dicho sobre la propia foto: es lo que se mira al elegir, antes de
            ampliarla (ver `AvisoImagenReferencial`). */}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-medium tracking-wide text-white uppercase">
          Referencial
        </span>
      </button>

      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{item.descripcion}</DialogTitle>
            <DialogDescription>
              {item.codigo} · {item.unidadMedida} · imagen del catálogo
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded border bg-white p-2">
            <img
              src={src}
              alt={item.descripcion}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>
          <AvisoImagenReferencial />
        </DialogContent>
      </Dialog>
    </>
  )
}

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

  // Error a nivel del arreglo (ej. "Agregá al menos un ítem"): no lo pinta ningún
  // campo, así que se muestra acá. Al ser un field array, RHF lo deja en `.root`.
  const { errors } = useFormState({ control, name: "detalles" })
  const errorDetalles = errors.detalles as
    { message?: string; root?: { message?: string } } | undefined
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

            {/* Desde lg la foto va a la IZQUIERDA y ocupa las DOS filas (pedido
                del usuario): a la derecha, los campos y debajo la Observación.
                Más angosto se apila: foto arriba y campos a todo el ancho — al
                costado dejaba una columna donde no entraba nada. */}
            <div className="flex flex-col gap-3 lg:flex-row">
              <FotoItem item={elegido} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/*
                  Desde lg, columnas de ANCHO FIJO para los números y el resto
                  para el ítem. Era una grilla de 12 con col-span, pero al
                  sumarse la foto a la izquierda las columnas de 1/12 quedaron
                  de ~55 px: el precio quedaba tapado por el subtotal y los
                  rótulos se pisaban. Los anchos fijos garantizan que un número
                  entre siempre, y lo que sobra es para la descripción, que es
                  lo que se trunca primero sin perder nada.
                  Orden: Ítem · Unidad · Cantidad · Prec.unit. · Subtotal. El
                  Subtotal incluye el lugar de la «X» de quitar (`pr-7`).
                  En md van dos columnas y en móvil, apilado.
                */}
                <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_6rem_5.5rem_6.5rem_8rem]">
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
                    className="md:col-span-2 lg:col-span-1"
                  />
                  {/* Unidad de medida del ítem elegido (solo lectura, deriva del ítem). */}
                  <div className="flex flex-col gap-2">
                    <FieldLabel>Unidad</FieldLabel>
                    <div className="flex h-9 items-center rounded-md border bg-muted px-3">
                      <span className="truncate text-sm text-muted-foreground">
                        {unidad || "—"}
                      </span>
                    </div>
                  </div>

                  <NumberField
                    name={
                      `detalles.${index}.cantidad` as Path<IngresoFormValues>
                    }
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
                    label="Prec.unit."
                    control={control}
                    step="0.00001"
                    min={0}
                    placeholder="0.00"
                    disabled={disabled}
                  />
                  {/* Subtotal (derivado). El `pr-7` le deja lugar a la «X» de la
                  esquina, que cae justo sobre esta columna; el pie del Total
                  usa el mismo valor para quedar alineado con el monto. */}
                  <div className="flex flex-col gap-2 lg:pr-7">
                    <FieldLabel className="lg:text-right">Subtotal</FieldLabel>
                    <div className="flex h-9 items-center justify-end">
                      <span className="text-sm font-medium tabular-nums">
                        {moneda(subtotal)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* La observación es lo que distingue este lote de otros del
                  mismo ítem (la marca, el color): se imprime junto a la
                  descripción. */}
                <InputField
                  name={
                    `detalles.${index}.observacion` as Path<IngresoFormValues>
                  }
                  label="Observación"
                  rotuloAlCostado
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

          Las clases salen de `lib/utils` y las comparte con `EgresoLineas`: los
          dos formularios de líneas tienen que verse hermanos, y antes eso
          dependía de acordarse de tocar los dos archivos. */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ...LINEA_VACIA })}
          className={cn(
            BOTON_AGREGAR_LINEA,
            mensajeDetalles && BOTON_AGREGAR_LINEA_ERROR
          )}
        >
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      )}

      {/* Total: alineado a la DERECHA, como la columna Subtotal de las líneas.
          El `pr-7` es el mismo que usa esa columna (lugar de la «X» de la
          esquina), para que el monto caiga bajo los de arriba. */}
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
