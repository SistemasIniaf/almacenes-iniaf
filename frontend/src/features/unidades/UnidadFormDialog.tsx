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
import { unidadSchema } from "@/features/unidades/unidades.schema"
import {
  useActualizarUnidad,
  useCrearUnidad,
} from "@/features/unidades/useUnidades"

import type { UnidadFormValues } from "@/features/unidades/unidades.schema"
import type { Unidad } from "@/features/unidades/unidades.types"

interface UnidadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con unidad = editar. */
  unidad: Unidad | null
}

const VALORES_INICIALES: UnidadFormValues = {
  nombre: "",
  sigla: "",
  activo: true,
}

export function UnidadFormDialog({
  open,
  onOpenChange,
  unidad,
}: UnidadFormDialogProps) {
  const esEdicion = unidad !== null
  const crear = useCrearUnidad()
  const actualizar = useActualizarUnidad()
  const guardando = crear.isPending || actualizar.isPending

  const { control, handleSubmit, reset } = useForm<UnidadFormValues>({
    resolver: zodResolver(unidadSchema),
    defaultValues: VALORES_INICIALES,
  })

  // El dialogo se monta una sola vez: hay que recargar el formulario cada vez
  // que se abre, si no queda con los datos de la unidad editada anteriormente.
  useEffect(() => {
    if (!open) return
    reset(
      unidad
        ? { nombre: unidad.nombre, sigla: unidad.sigla, activo: unidad.activo }
        : VALORES_INICIALES
    )
  }, [open, unidad, reset])

  async function onSubmit(values: UnidadFormValues) {
    try {
      if (esEdicion) {
        await actualizar.mutateAsync({ id: unidad.id, ...values })
      } else {
        await crear.mutateAsync(values)
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion; el dialogo se queda abierto
      // para que el usuario pueda corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar unidad" : "Nueva unidad"}
          </DialogTitle>
          <DialogDescription>
            Área administrativa de la institución (ej. Unidad de Planificación).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <InputField
              name="nombre"
              label="Nombre"
              control={control}
              placeholder="Unidad de Planificación"
              disabled={guardando}
            />

            <InputField
              name="sigla"
              label="Sigla"
              control={control}
              placeholder="UP"
              disabled={guardando}
            />

            <CheckboxField
              name="activo"
              label="Activa"
              control={control}
              required={false}
              disabled={guardando}
              description="Las unidades inactivas no se pueden asignar a usuarios."
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
                {esEdicion ? "Guardar cambios" : "Crear unidad"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
