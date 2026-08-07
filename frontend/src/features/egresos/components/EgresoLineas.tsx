import { useState } from "react"
import { useFieldArray, useFormState, useWatch } from "react-hook-form"
import { ImageOff, Plus, X } from "lucide-react"

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
import { NumberField } from "@/components/form/NumberField"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import {
  ITEMS_POR_BUSQUEDA,
  useBuscarLotes,
} from "@/features/egresos/hooks/useBuscarLotes"
import { LINEA_VACIA } from "@/features/egresos/egresos.schema"
import { descripcionConNota } from "@/features/egresos/egresos.types"

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

/**
 * Etiqueta del lote: descripción, la **nota del lote resaltada**, disponible y
 * fuente. Ni la FECHA ni el NÚMERO de ingreso van acá (2026-07-30): el selector
 * viejo los traía y solo alargaban la línea — para elegir de dónde sale el
 * material lo que decide es la fuente, que es de quien hay que rendir la plata.
 * El número sigue estando donde importa: en el diálogo de la foto y en la ficha.
 *
 * La nota va en el campo `nota` del combo, que la dibuja como etiqueta con fondo
 * (2026-08-07). Antes iba entre paréntesis dentro del `label`, en el mismo tono
 * que el resto, y se leía como parte del nombre del ítem — o sea que no cumplía
 * su única función, que es avisar que ESTE lote no es el otro. Es lo único que
 * los distingue: comparten código, descripción y, salvo que les hayan sacado
 * foto propia, también la imagen.
 *
 * El disponible se corre a `descripcion` (gris) para dejarle el tono fuerte a lo
 * que identifica al lote. No se pierde nada: el dato contra el que se escribe la
 * cantidad es el de abajo del campo, no éste.
 *
 * Muestra el DISPONIBLE, no el saldo, y los agotados directamente no se ofrecen.
 */
const aOpcion = (l: LoteElegible): ComboboxOption => ({
  value: String(l.id),
  label: l.itemDescripcion,
  nota: l.observacion ?? undefined,
  descripcion: `disp. ${l.disponible} ${l.unidadMedida} · ${l.fuente}`,
  busqueda: l.itemCodigo,
  imagen: l.imagen,
})

/**
 * Foto del ítem del lote elegido, ampliable al hacer clic. Sirve para confirmar
 * de un vistazo que el lote es el material que se quiso pedir — dos ítems pueden
 * tener descripciones casi iguales.
 *
 * Sin lote (línea recién agregada) o sin foto cargada muestra un marco vacío del
 * mismo tamaño, para que la fila no cambie de alto al elegir.
 *
 * Mide `size-16` = 64 px, que es exactamente el alto de un campo con su rótulo
 * (20 de la etiqueta + 8 del hueco + 36 del input). Así llena la tarjeta de
 * arriba abajo sin desalinear nada: su borde superior cae sobre el de los
 * rótulos y el inferior sobre el de los inputs. Si algún día cambia el alto de
 * los campos, este número lo acompaña.
 */
function FotoLote({ lote }: { lote?: LoteElegible }) {
  const [ampliada, setAmpliada] = useState(false)

  if (!lote?.imagen) {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded border border-dashed bg-muted/40">
        <ImageOff className="size-5 text-muted-foreground/60" />
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        className="size-16 shrink-0 overflow-hidden rounded border transition-opacity hover:opacity-80"
        aria-label={`Ver foto de ${descripcionConNota(lote.itemDescripcion, lote.observacion)}`}
      >
        <img
          src={lote.imagen}
          alt={lote.itemDescripcion}
          className="size-full object-cover"
        />
      </button>

      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            {/* La nota va en el TÍTULO: la foto es la de catálogo y puede no
                mostrar la marca o el color de este lote, así que acá es donde
                más hace falta leerla. */}
            <DialogTitle>
              {descripcionConNota(lote.itemDescripcion, lote.observacion)}
            </DialogTitle>
            <DialogDescription>
              {lote.itemCodigo} · ingreso {lote.numeroIngreso} · {lote.fuente}
            </DialogDescription>
          </DialogHeader>
          <img
            src={lote.imagen}
            alt={lote.itemDescripcion}
            className="max-h-[60vh] w-full rounded object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

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

  const { errors } = useFormState({ control, name: "detalles" })
  const errorDetalles = errors.detalles as
    { message?: string; root?: { message?: string } } | undefined
  const mensajeDetalles = errorDetalles?.root?.message ?? errorDetalles?.message

  /**
   * Lotes ya tomados por OTRAS líneas: el combo de esta no los ofrece. Sin este
   * filtro se puede pedir dos veces el mismo lote y cada línea muestra el
   * disponible entero, sin descontar lo que pide la otra — así se llega a pedir
   * más de lo que hay. El backend lo rechaza igual (`validarDisponibilidad`),
   * pero recién al guardar y con el pedido ya armado.
   *
   * Se excluye a sí misma para no borrar su propia selección de la lista.
   */
  const opcionesPara = (indice: number) => {
    const tomados = new Set(
      (lineas ?? [])
        .map((linea, i) =>
          i === indice ? "" : (linea?.ingresoDetalleId ?? "")
        )
        .filter(Boolean)
    )
    return tomados.size === 0
      ? opciones
      : opciones.filter((opcion) => !tomados.has(opcion.value))
  }

  function cargarMas() {
    // No se pide otra tanda mientras hay una en vuelo: si no, acercarse al final
    // encadena pedidos que nadie hizo.
    if (hasNextPage && !isFetching) void fetchNextPage()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado con peso propio + contador, igual que `IngresoLineas`: esto
          no es un campo más, es el contenido del pedido. El asterisco se queda
          porque acá los ítems son obligatorios de verdad. */}
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="text-base font-semibold">
          Ítems del pedido<span className="text-red-500">*</span>
        </FieldLabel>
        {fields.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
            {fields.length} {fields.length === 1 ? "ítem" : "ítems"}
          </span>
        )}
      </div>

      {/* Error del ARREGLO (ej. «Agregá al menos un ítem»): no lo pinta ningún
          campo, así que sin esto el formulario se negaba a enviarse sin decir
          por qué. react-hook-form lo deja en `.root` por ser un field array. */}
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
          Todavía no agregaste ítems. Cada línea sale de un lote concreto:
          elegís de qué compra y de qué fuente se descuenta el material.
        </p>
      )}

      {fields.map((field, indice) => {
        const elegido = lineas?.[indice]?.ingresoDetalleId
        const lote = elegido ? porId.get(Number(elegido)) : undefined
        const pedido = Number(lineas?.[indice]?.cantidadSolicitada)
        const excedido = lote != null && pedido > lote.disponible

        return (
          // `bg-card`: la sección va sobre un panel tintado, así que cada línea
          // necesita superficie propia para leerse como una ficha. Igual que en
          // `IngresoLineas`.
          <div key={field.id} className="relative rounded-md border bg-card p-3">
            {/* Quitar la línea va en la esquina de la tarjeta, no en la fila de
                campos: así no gasta una columna del grid —se la queda el selector
                de lote, que es el que más texto necesita— ni participa de la
                alineación de los inputs. La esquina queda libre porque la última
                columna (Disponible) alinea su texto abajo. */}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(indice)}
                aria-label="Quitar ítem"
              >
                <X className="size-4" />
              </Button>
            )}

            {/* La foto va FUERA del grid: como bloque flex ocupa solo sus 64 px
                y el resto del ancho queda entero para los campos. Cuando gastaba
                una columna del grid se reservaban ~115 px para dibujar 36. */}
            <div className="flex gap-3">
              <FotoLote lote={lote} />

              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-12">
                {/* 10 de 12 para el lote y 2 para la cantidad: es un número de
                    pocos dígitos y no necesita más, mientras que la etiqueta del
                    lote —descripción + nota + disponible + fuente— es lo que se
                    corta. Antes iban 9/3 y sobraba campo para escribir «2». */}
                <div className="sm:col-span-10">
                  <ComboboxField
                    name={`detalles.${indice}.ingresoDetalleId`}
                    label="Lote"
                    control={control}
                    disabled={disabled}
                    options={opcionesPara(indice)}
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
                      if (encontrado)
                        setVistos((previos) => [...previos, encontrado])
                    }}
                    onEndReached={cargarMas}
                    footer={
                      hasNextPage
                        ? `Mostrando ${encontrados.length} — scrolleá para ver más`
                        : undefined
                    }
                  />
                </div>

                {/* El disponible va DEBAJO del campo de cantidad, no en una
                    columna aparte: ahí cae justo donde está el cursor mientras
                    se escribe el número, que es cuando el dato sirve. Se pone en
                    rojo apenas lo pedido lo supera — el backend igual lo rechaza
                    al guardar, pero avisar acá evita llegar hasta ahí. */}
                <div className="sm:col-span-2">
                  <NumberField
                    name={`detalles.${indice}.cantidadSolicitada`}
                    label="Cantidad"
                    control={control}
                    disabled={disabled}
                    // Las flechas mueven de a 1; los decimales se escriben igual.
                    step="any"
                    min={0}
                  />
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      excedido
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {lote
                      ? excedido
                        ? `Solo hay ${lote.disponible} ${lote.unidadMedida} disponibles`
                        : `Disponible: ${lote.disponible} ${lote.unidadMedida}`
                      : "Elegí un lote para ver el disponible"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* El botón va DEBAJO de las líneas y ocupa todo el ancho: es donde el ojo
          termina de leer la última fila y hacia dónde sigue el trabajo. Arriba a
          la derecha, en tamaño chico, se perdía contra el título. El borde
          punteado lo lee como «acá se agrega otra», no como una acción del
          formulario que compita con Guardar. */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ...LINEA_VACIA })}
          className={cn(
            // Punteado PERO con el color de acción: en modo claro, un `outline`
            // gris sobre fondo blanco no se lee como botón. El fondo tenue y el
            // texto en primario lo hacen visible sin volverlo sólido — sólido
            // está reservado para «Guardar», que es el submit del formulario.
            "h-11 w-full border-dashed border-primary/50 bg-primary/5 font-medium text-primary hover:border-primary hover:bg-primary/10 hover:text-primary",
            mensajeDetalles &&
              "border-destructive/60 bg-destructive/5 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      )}

      {fields.length > 0 && encontrados.length >= ITEMS_POR_BUSQUEDA && (
        <p className="text-xs text-muted-foreground">
          Si no encontrás un ítem, escribí parte de su código o descripción: la
          búsqueda va contra el servidor.
        </p>
      )}
    </div>
  )
}
