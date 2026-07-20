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

  const { data: partidas = [] } = usePartidasSeleccionables()

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
        // El backend NO admite cambiar codigo ni partida: el codigo deriva de la
        // partida y moverlo lo dejaria inconsistente. La imagen tampoco viaja
        // aca: en edicion se sube sola al elegirla.
        await actualizar.mutateAsync({
          id: item.id,
          descripcion: valores.descripcion,
          unidadMedida: valores.unidadMedida,
          activo: valores.activo,
        })
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? `Código ${item.codigo} — el código y la partida no se pueden cambiar.`
              : "El código se genera solo a partir de la partida elegida."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {esEdicion ? (
              // En edición la partida es informativa: no se puede mover el ítem.
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Partida</p>
                <p className="font-medium">
                  {item.partida.codigo} — {item.partida.denominacion}
                </p>
              </div>
            ) : (
              <ComboboxField
                name="partidaId"
                label="Partida"
                control={control}
                disabled={guardando}
                placeholder="Buscá por código o denominación"
                vacio="No hay partidas asignables."
                options={partidas.map((partida) => ({
                  value: String(partida.id),
                  label: partida.codigo,
                  descripcion: partida.denominacion,
                  busqueda: partida.codigo,
                }))}
              />
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
              disabled={guardando}
            />

            <CheckboxField
              name="activo"
              label="Activo"
              control={control}
              required={false}
              disabled={guardando}
              description="Los ítems inactivos no aparecen para nuevos movimientos."
            />

            {esEdicion ? (
              // Editando el ítem ya existe: la imagen se sube al instante
              // contra su endpoint, sin esperar al submit.
              <ImageField
                label="Imagen referencial"
                imagenUrl={imagenUrl}
                procesando={imagen.isPending}
                disabled={guardando}
                description="Se guarda al momento, sin esperar a «Guardar cambios»."
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
                    onSeleccionar={(archivo) => field.onChange(archivo)}
                    onQuitar={() => field.onChange(null)}
                  />
                )}
              />
            )}

            <DialogFooter className="mt-2">
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
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
