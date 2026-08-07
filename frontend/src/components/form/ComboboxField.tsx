import { useCallback, useEffect, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { Check, ChevronsUpDown, ImageOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import type { ReactNode } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"

export interface ComboboxOption {
  value: string
  label: string
  /** Texto adicional que se muestra en gris debajo (ej. la denominación). */
  descripcion?: string
  /**
   * Dato que DISTINGUE a esta opción de otras casi idénticas (ej. la nota del
   * lote: «COLOR AZUL»). Se dibuja como una etiqueta resaltada, no como parte
   * de la línea: en texto corrido se leía como parte del nombre del ítem y
   * pasaba desapercibido — que es justo lo contrario de para qué está.
   */
  nota?: string
  /** Texto extra por el que también se puede buscar (ej. el código). */
  busqueda?: string
  /**
   * URL absoluta de una miniatura para esta opción (ej. la foto del ítem). Es
   * opcional y por opción: en una lista donde solo algunos la tienen, los que no
   * muestran un marco vacío del mismo tamaño para que las filas no se desalineen.
   */
  imagen?: string | null
}

interface ComboboxFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label: string
  options: ComboboxOption[]
  placeholder?: string
  vacio?: string
  id?: string
  description?: string
  disabled?: boolean
  required?: boolean
  className?: string
  /** Texto del cuadro de búsqueda de la lista. */
  buscarPlaceholder?: string
  /**
   * Búsqueda contra el SERVIDOR. Si viene, cmdk deja de filtrar en memoria y
   * `options` se toma tal cual llega (el que consume decide qué trae cada
   * término). Se usa para catálogos que no entran en el navegador (ítems).
   */
  onSearchChange?: (valor: string) => void
  /** Término actual, cuando la búsqueda es contra el servidor (controlado). */
  search?: string
  /** Muestra "Buscando..." mientras la consulta está en vuelo. */
  loading?: boolean
  /** Pie de la lista (ej. "mostrando 50 de 23.005"). */
  footer?: ReactNode
  /**
   * Avisa qué opción se eligió (además del `onChange` del formulario, que solo
   * lleva el value). Sirve con búsqueda del servidor, donde quien consume
   * necesita recordar el registro elegido: la lista de opciones cambia con cada
   * término y el seleccionado puede dejar de estar en ella.
   */
  onSelectOption?: (opcion: ComboboxOption) => void
  /**
   * Se llama al acercarse al final de la lista, para cargar la tanda siguiente
   * (catálogos grandes). Puede dispararse varias veces: quien lo implementa
   * debe ignorar el pedido si ya está trayendo o si no queda nada.
   */
  onEndReached?: () => void
}

/**
 * Miniatura de una opción. Cuando la lista muestra fotos, las opciones SIN foto
 * dejan el mismo hueco: si no, cada fila arrancaría en una sangría distinta y la
 * lista se leería en zigzag.
 */
function Miniatura({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded border border-dashed bg-muted/40">
        <ImageOff className="size-3.5 text-muted-foreground/60" />
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      // `loading="lazy"`: la lista puede traer decenas de opciones y solo se ven
      // unas pocas a la vez.
      loading="lazy"
      className="size-8 shrink-0 rounded border object-cover"
    />
  )
}

/**
 * Etiqueta de una opción: el `label`, la `nota` RESALTADA y la `descripcion` en
 * gris. Se usa igual en la lista y en el botón cerrado — si el resaltado fuera
 * solo de la lista, desaparecería justo cuando la opción quedó elegida, que es
 * cuando conviene seguir viendo cuál se eligió.
 *
 * La nota va en una etiqueta con fondo y no en el mismo tono del resto porque es
 * lo único que separa dos opciones por lo demás idénticas (dos lotes del mismo
 * ítem comparten descripción y foto): en una línea corrida se leía como parte
 * del nombre y pasaba desapercibida.
 */
function EtiquetaOpcion({ opcion }: { opcion: ComboboxOption }) {
  return (
    <>
      {opcion.label}
      {opcion.nota && (
        // Etiqueta NEUTRA (gris), no del color de acción: la fila resaltada de la
        // lista se pinta con ese mismo color, así que una etiqueta primaria
        // quedaba color sobre color y desaparecía justo en la opción que el
        // usuario está mirando. Sobre la fila resaltada invierte al par
        // accent/accent-foreground, igual que hace la descripción.
        <span className="mx-1.5 rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-foreground group-data-[selected=true]/opcion:bg-accent-foreground/20 group-data-[selected=true]/opcion:text-accent-foreground">
          {opcion.nota}
        </span>
      )}
      {opcion.descripcion && (
        <span className="text-muted-foreground group-data-[selected=true]/opcion:text-accent-foreground">
          {opcion.nota ? "" : " "}— {opcion.descripcion}
        </span>
      )}
    </>
  )
}

/**
 * Selector con buscador para listas largas donde un `<select>` no escala
 * (partidas del clasificador, catalogo de items — ver CLAUDE.md).
 *
 * El valor se maneja como string, igual que `SelectField`, para que el
 * formulario lo convierta a number al armar el payload.
 */
export function ComboboxField<T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = "Seleccioná una opción",
  vacio = "Sin resultados.",
  id,
  description,
  disabled = false,
  required = true,
  className,
  buscarPlaceholder = "Buscar...",
  onSearchChange,
  search,
  loading = false,
  footer,
  onSelectOption,
  onEndReached,
}: ComboboxFieldProps<T>) {
  // Con búsqueda del servidor el filtrado ya lo hizo la API: cmdk no debe
  // volver a filtrar (si no, esconde resultados que el backend sí encontró,
  // ej. buscar por una palabra que está en la descripción pero no en la etiqueta).
  const enServidor = onSearchChange != null
  const [abierto, setAbierto] = useState(false)
  // Valor "activo" de cmdk (el resaltado por teclado). Al abrir se apunta al
  // item seleccionado, si no cmdk resalta el primero por defecto.
  const [resaltado, setResaltado] = useState("")
  const fieldId = id || `field-${name}`
  // Basta con que UNA opción traiga foto para que la columna exista en todas.
  const conImagenes = options.some((opcion) => opcion.imagen)
  const limpiarWheel = useRef<(() => void) | null>(null)
  // El nodo de la lista se guarda en estado (no en un ref) para poder scrollearlo
  // desde un efecto: leer un ref en render lo prohíbe el lint del repo.
  const [nodoLista, setNodoLista] = useState<HTMLDivElement | null>(null)

  // La lista vuelve arriba cuando cambia el término. Si quedara al fondo, el
  // `onEndReached` se dispararía solo con los resultados nuevos y encadenaría
  // tandas que nadie pidió.
  //
  // Dos disparadores, porque ocurren en momentos distintos: `search` es lo que
  // se tipea (inmediato) y `primeraOpcion` avisa cuando el resultado REEMPLAZA
  // al anterior, que con búsqueda del servidor llega ~300 ms después. Cargar la
  // tanda siguiente NO lo dispara: eso agrega al final y deja la primera igual.
  const primeraOpcion = options[0]?.value
  useEffect(() => {
    // `scrollTo` y no `scrollTop = 0`: asignarle una propiedad a un valor que
    // viene de useState lo marca el lint como mutación de estado.
    nodoLista?.scrollTo({ top: 0 })
  }, [search, primeraOpcion, nodoLista])

  // Texto interno (cmdk) de cada opción, el mismo que se usa como `value` del item.
  // Incluye la nota: es parte de lo que se ve, así que tiene que ser parte de lo
  // que el filtro local encuentra.
  const textoCmdk = (o: ComboboxOption) =>
    `${o.busqueda ?? ""} ${o.label} ${o.nota ?? ""} ${o.descripcion ?? ""}`

  // Dentro de un Dialog, el popover se portaliza a `body`, fuera del bloqueo de
  // scroll (`react-remove-scroll`) del diálogo: la barra funciona pero la rueda
  // del mouse no desplaza la lista. Se engancha un listener `wheel` NATIVO
  // no-pasivo directo sobre la lista al montarse (callback ref: corre justo
  // cuando el nodo existe, sin timing). React marca su `onWheel` como passive y
  // ahí `preventDefault` no corre; hacerlo nosotros evita también el
  // doble-scroll fuera de un diálogo.
  const refLista = useCallback((lista: HTMLDivElement | null) => {
    limpiarWheel.current?.()
    limpiarWheel.current = null
    setNodoLista(lista)
    if (!lista) return
    const onWheel = (evento: WheelEvent) => {
      evento.preventDefault()
      // `deltaMode`: 0 = píxeles, 1 = líneas (Firefox suele reportar ~3 por
      // muesca), 2 = páginas. Sin escalar, en líneas el scroll es imperceptible.
      const factor =
        evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? lista.clientHeight : 1
      lista.scrollTop += evento.deltaY * factor
    }
    lista.addEventListener("wheel", onWheel, { passive: false })
    limpiarWheel.current = () =>
      lista.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const seleccionada = options.find(
          (opcion) => opcion.value === field.value
        )

        return (
          <Field
            data-invalid={fieldState.invalid}
            className={cn("gap-2", className)}
          >
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <span className="text-red-500">*</span>}
            </FieldLabel>
            <Popover
              open={abierto}
              onOpenChange={(nuevo) => {
                // Al abrir, el resaltado arranca sobre la opción ya elegida.
                if (nuevo) setResaltado(seleccionada ? textoCmdk(seleccionada) : "")
                // Al cerrar se limpia el término, para que la próxima apertura
                // no arranque con la búsqueda de la vez anterior.
                else onSearchChange?.("")
                setAbierto(nuevo)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  id={fieldId}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={abierto}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="w-full justify-between font-normal"
                >
                  {/* El botón cerrado NO lleva miniatura, a propósito: la haría
                      más alta que los campos de al lado y la fila quedaría
                      desalineada. La foto se ve al desplegar la lista, y quien
                      la necesite junto al campo la muestra por su cuenta (ver
                      `FotoLote` en EgresoLineas). */}
                  <span
                    className={cn(
                      "truncate",
                      !seleccionada && "text-muted-foreground"
                    )}
                  >
                    {seleccionada ? (
                      <EtiquetaOpcion opcion={seleccionada} />
                    ) : (
                      placeholder
                    )}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                <Command
                  value={resaltado}
                  onValueChange={setResaltado}
                  shouldFilter={!enServidor}
                  filter={(value, termino) => {
                    // `value` es el texto de busqueda que arma cada item abajo.
                    const normalizar = (texto: string) =>
                      texto
                        .normalize("NFD")
                        .replace(/\p{Diacritic}/gu, "")
                        .toLowerCase()
                    return normalizar(value).includes(normalizar(termino))
                      ? 1
                      : 0
                  }}
                >
                  <CommandInput
                    placeholder={buscarPlaceholder}
                    value={enServidor ? (search ?? "") : undefined}
                    onValueChange={onSearchChange}
                  />
                  <CommandList
                    ref={refLista}
                    // `onScroll` de React alcanza acá (no necesita ser no-pasivo
                    // como el `wheel` de arriba, que sí llama a preventDefault) y
                    // se dispara también con el scroll que hace ese handler.
                    onScroll={(evento) => {
                      if (!onEndReached) return
                      const lista = evento.currentTarget
                      const faltante =
                        lista.scrollHeight - lista.scrollTop - lista.clientHeight
                      // Un par de filas antes del fondo, para que la tanda llegue
                      // sin que el scroll se frene.
                      if (faltante < 64) onEndReached()
                    }}
                  >
                    <CommandEmpty>
                      {loading ? "Buscando..." : vacio}
                    </CommandEmpty>
                    {loading && options.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Buscando...
                      </div>
                    )}
                    <CommandGroup>
                      {options.map((opcion) => (
                        <CommandItem
                          key={opcion.value}
                          // `group/opcion` permite que la descripcion (muted)
                          // cambie de color cuando la fila queda resaltada, si no
                          // se pierde sobre el fondo de seleccion.
                          className="group/opcion"
                          // cmdk busca sobre este string, no sobre el JSX.
                          value={textoCmdk(opcion)}
                          onSelect={() => {
                            field.onChange(opcion.value)
                            onSelectOption?.(opcion)
                            setAbierto(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              opcion.value === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {conImagenes && (
                            <Miniatura url={opcion.imagen} alt={opcion.label} />
                          )}
                          <span className="min-w-0 truncate">
                            <EtiquetaOpcion opcion={opcion} />
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  {/* Fuera de CommandList a propósito: adentro scrollea con las
                      opciones y solo se ve al llegar al fondo, que es justo
                      cuando deja de importar. Acá queda fijo al pie del popover. */}
                  {footer && (
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                      {footer}
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>

            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
