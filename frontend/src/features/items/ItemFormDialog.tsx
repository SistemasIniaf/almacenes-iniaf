import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { CheckboxField } from "@/components/form/CheckboxField"
import { ComboboxField } from "@/components/form/ComboboxField"
import { ImageField } from "@/components/form/ImageField"
import { InputField } from "@/components/form/InputField"
import { itemSchema } from "@/features/items/items.schema"
import {
  useActualizarItem,
  useCrearItem,
  useImagenItem,
} from "@/features/items/useItems"
import { usePartidasSeleccionables } from "@/features/partidas/usePartidas"

import type { ItemFormValues } from "@/features/items/items.schema"
import type { Item } from "@/features/items/items.types"

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con item = editar. */
  item: Item | null
  /**
   * Se llama cuando el ítem se creó pero la subida de su imagen falló: la
   * página pasa a editar ese ítem, de modo que el diálogo (que sigue abierto)
   * se convierte en el de edición y el usuario reintenta la imagen sin
   * recargar el formulario.
   */
  onCreado: (item: Item) => void
}

const VALORES_INICIALES: ItemFormValues = {
  descripcion: "",
  unidadMedida: "",
  partidaId: "",
  activo: true,
  archivo: null,
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  onCreado,
}: ItemFormDialogProps) {
  const esEdicion = item !== null
  const crear = useCrearItem()
  const actualizar = useActualizarItem()
  const imagen = useImagenItem()
  const guardando = crear.isPending || actualizar.isPending || imagen.isPending
  // Con movimientos, partida y unidad quedan fijas (el backend responde 409).
  const fijo = esEdicion && item.tieneMovimientos

  const { data: partidas = [] } = usePartidasSeleccionables()

  const opcionesPartida = partidas.map((partida) => ({
    value: String(partida.id),
    label: partida.codigo,
    descripcion: partida.denominacion,
    busqueda: partida.codigo,
  }))
  // Al editar, la partida actual va siempre en la lista aunque ya no sea
  // asignable (se desactivó después): si no, el campo se vería vacío.
  if (
    esEdicion &&
    !opcionesPartida.some((o) => o.value === String(item.partidaId))
  ) {
    opcionesPartida.unshift({
      value: String(item.partida.id),
      label: item.partida.codigo,
      descripcion: item.partida.denominacion,
      busqueda: item.partida.codigo,
    })
  }

  /**
   * La imagen se maneja aparte del formulario porque su endpoint responde al
   * instante. El preview sale de la respuesta de la ultima subida/borrado (si
   * fue de ESTE item) y, si no hubo ninguna, del item que llego por props: asi
   * se actualiza sin esperar a que el padre reciba la lista ya refrescada.
   */
  const imagenUrl =
    imagen.data && imagen.data.id === item?.id
      ? imagen.data.imagenUrl
      : (item?.imagenUrl ?? null)

  const { control, handleSubmit, reset } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: VALORES_INICIALES,
  })

  useEffect(() => {
    if (!open) return
    reset(
      item
        ? {
            descripcion: item.descripcion,
            unidadMedida: item.unidadMedida,
            partidaId: String(item.partidaId),
            activo: item.activo,
            archivo: null,
          }
        : VALORES_INICIALES
    )
  }, [open, item, reset])

  async function onSubmit(valores: ItemFormValues) {
    if (esEdicion) {
      try {
        // Partida y unidad viajan solo si el item no tiene movimientos (si no,
        // el backend responde 409). La imagen no viaja aca: en edicion se sube
        // sola al elegirla.
        const actualizado = await actualizar.mutateAsync({
          id: item.id,
          descripcion: valores.descripcion,
          activo: valores.activo,
          ...(fijo
            ? {}
            : {
                unidadMedida: valores.unidadMedida,
                partidaId: Number(valores.partidaId),
              }),
        })
        // Cambiar de partida cambia el codigo: se avisa, porque es el dato con
        // el que la gente busca el item.
        if (actualizado.codigo !== item.codigo) {
          toast.info(
            `El ítem cambió de partida: su código ahora es ${actualizado.codigo} (antes ${item.codigo}).`
          )
        }
        onOpenChange(false)
      } catch {
        // El toast de error lo emite la mutacion; el dialogo se queda abierto.
      }
      return
    }

    // --- Creacion: son DOS peticiones encadenadas ---
    let creado: Item
    try {
      creado = await crear.mutateAsync({
        descripcion: valores.descripcion,
        unidadMedida: valores.unidadMedida,
        partidaId: Number(valores.partidaId),
        activo: valores.activo,
      })
    } catch {
      // No se creo nada: el toast ya lo emitio la mutacion.
      return
    }

    if (!valores.archivo) {
      onOpenChange(false)
      return
    }

    try {
      await imagen.mutateAsync({ id: creado.id, archivo: valores.archivo })
      onOpenChange(false)
    } catch {
      // El item SI se creo. En vez de cerrar y perder el contexto, se le avisa
      // a la pagina para que pase a editar ese item: el dialogo sigue abierto y
      // se convierte en el de edicion, donde reintentar la imagen es un clic.
      onCreado(creado)
      toast.warning(
        `El ítem ${creado.codigo} se creó, pero la imagen no se pudo subir. Probá de nuevo.`
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl md:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? `Código ${item.codigo}.`
              : "El código se genera solo a partir de la partida elegida."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Dos columnas desde md (pedido del usuario): los datos a la
              izquierda y la imagen a la derecha, con alto para verse bien. En
              pantallas chicas se apilan, la imagen debajo. */}
          <div className="grid gap-6 md:grid-cols-2">
            <FieldGroup>
              {fijo ? (
                // Con movimientos la partida es informativa: moverla cambiaría
                // el código de algo que ya figura en ingresos, kardex y reportes.
                <div className="rounded-md border bg-muted/50 p-3 text-sm">
                  <p className="text-muted-foreground">Partida</p>
                  <p className="font-medium">
                    {item.partida.codigo} — {item.partida.denominacion}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ya figura en ingresos: la partida y la unidad de medida no
                    se pueden cambiar. Si fue un error, anulá esos ingresos, dá
                    de baja el ítem y creálo de nuevo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ComboboxField
                    name="partidaId"
                    label="Partida"
                    control={control}
                    disabled={guardando}
                    placeholder="Buscá por código o denominación"
                    vacio="No hay partidas asignables."
                    options={opcionesPartida}
                  />
                  {esEdicion && (
                    <p className="text-xs text-muted-foreground">
                      Todavía no tiene movimientos, así que se puede corregir.
                      Si cambiás la partida, el ítem recibe un código nuevo.
                    </p>
                  )}
                </div>
              )}

              <InputField
                name="descripcion"
                label="Descripción"
                control={control}
                disabled={guardando}
              />

              <InputField
                name="unidadMedida"
                label="Unidad de medida"
                control={control}
                disabled={guardando || fijo}
              />

              <CheckboxField
                name="activo"
                label="Activo"
                control={control}
                required={false}
                disabled={guardando}
                description="Los ítems inactivos no aparecen para nuevos movimientos."
              />
            </FieldGroup>

            <div>
              {esEdicion ? (
                // Editando el ítem ya existe: la imagen se sube al instante
                // contra su endpoint, sin esperar al submit.
                <ImageField
                  label="Imagen referencial"
                  imagenUrl={imagenUrl}
                  procesando={imagen.isPending}
                  disabled={guardando}
                  description="Se guarda al momento, sin esperar a «Guardar cambios»."
                  altoPreview="h-52 md:h-64"
                  onSeleccionar={(archivo) =>
                    imagen.mutate({ id: item.id, archivo })
                  }
                  onQuitar={() => imagen.mutate({ id: item.id, archivo: null })}
                />
              ) : (
                // Creando todavía no hay id, así que el archivo solo se guarda en
                // el formulario y se sube después del POST (ver onSubmit).
                <Controller
                  name="archivo"
                  control={control}
                  render={({ field }) => (
                    <ImageField
                      label="Imagen referencial"
                      imagenUrl={null}
                      archivoPendiente={field.value}
                      disabled={guardando}
                      description="Opcional. Se sube al crear el ítem."
                      altoPreview="h-52 md:h-64"
                      onSeleccionar={(archivo) => field.onChange(archivo)}
                      onQuitar={() => field.onChange(null)}
                    />
                  )}
                />
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="size-4 animate-spin" />}
              {/* Al crear con imagen son dos requests: conviene decir en cuál
                    va, si no parece que se colgó. */}
              {crear.isPending
                ? "Creando..."
                : imagen.isPending
                  ? "Subiendo imagen..."
                  : esEdicion
                    ? "Guardar cambios"
                    : "Crear ítem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
