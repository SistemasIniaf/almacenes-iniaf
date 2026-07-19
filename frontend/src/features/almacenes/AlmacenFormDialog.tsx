import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

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
import { InputField } from "@/components/form/InputField"
import { almacenSchema } from "@/features/almacenes/almacenes.schema"
import {
  useActualizarAlmacen,
  useCrearAlmacen,
} from "@/features/almacenes/useAlmacenes"

import type { AlmacenFormValues } from "@/features/almacenes/almacenes.schema"
import type { Almacen } from "@/features/almacenes/almacenes.types"

interface AlmacenFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con almacen = editar. */
  almacen: Almacen | null
}

const VALORES_INICIALES: AlmacenFormValues = {
  nombre: "",
  activo: true,
}

export function AlmacenFormDialog({
  open,
  onOpenChange,
  almacen,
}: AlmacenFormDialogProps) {
  const esEdicion = almacen !== null
  const crear = useCrearAlmacen()
  const actualizar = useActualizarAlmacen()
  const guardando = crear.isPending || actualizar.isPending

  const { control, handleSubmit, reset } = useForm<AlmacenFormValues>({
    resolver: zodResolver(almacenSchema),
    defaultValues: VALORES_INICIALES,
  })

  // El dialogo se monta una sola vez: hay que recargar el formulario cada vez
  // que se abre, si no queda con los datos del almacen editado anteriormente.
  useEffect(() => {
    if (!open) return
    reset(
      almacen
        ? { nombre: almacen.nombre, activo: almacen.activo }
        : VALORES_INICIALES
    )
  }, [open, almacen, reset])

  async function onSubmit(values: AlmacenFormValues) {
    try {
      if (esEdicion) {
        await actualizar.mutateAsync({ id: almacen.id, ...values })
      } else {
        await crear.mutateAsync(values)
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion (ej. nombre duplicado); el
      // dialogo se queda abierto para corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar almacén" : "Nuevo almacén"}
          </DialogTitle>
          <DialogDescription>
            Cada almacén maneja su propio stock y sus propios correlativos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <InputField
              name="nombre"
              label="Nombre"
              control={control}
              placeholder="Almacén Central La Paz"
              description="No puede repetirse: el nombre es único en el sistema."
              disabled={guardando}
            />

            <CheckboxField
              name="activo"
              label="Activo"
              control={control}
              required={false}
              disabled={guardando}
              description="Los almacenes inactivos no se pueden asignar a usuarios."
            />

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
                {esEdicion ? "Guardar cambios" : "Crear almacén"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
