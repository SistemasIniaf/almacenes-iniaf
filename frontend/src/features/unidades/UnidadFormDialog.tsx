import { useEffect, useMemo } from "react"
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
import { ComboboxField } from "@/components/form/ComboboxField"
import { InputField } from "@/components/form/InputField"
import {
  padreIdToForm,
  padreIdToPayload,
  unidadSchema,
} from "@/features/unidades/unidades.schema"
import {
  useActualizarUnidad,
  useCrearUnidad,
  useUnidadesParaSelector,
} from "@/features/unidades/useUnidades"

import type { UnidadFormValues } from "@/features/unidades/unidades.schema"
import type { UnidadArbol } from "@/features/unidades/unidades.types"

interface UnidadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con unidad = editar. */
  unidad: UnidadArbol | null
}

const VALORES_INICIALES: UnidadFormValues = {
  nombre: "",
  sigla: "",
  activo: true,
  padreId: "",
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

  const { data: unidadesParaSelector = [], isLoading: cargandoUnidades } =
    useUnidadesParaSelector()

  const { control, handleSubmit, reset, watch, setValue } =
    useForm<UnidadFormValues>({
      resolver: zodResolver(unidadSchema),
      defaultValues: VALORES_INICIALES,
    })

  const padreIdSeleccionado = watch("padreId")

  // El dialogo se monta una sola vez: hay que recargar el formulario cada vez
  // que se abre, si no queda con los datos de la unidad editada anteriormente.
  useEffect(() => {
    if (!open) return
    reset(
      unidad
        ? {
            nombre: unidad.nombre,
            sigla: unidad.sigla,
            activo: unidad.activo,
            padreId: padreIdToForm(unidad.padreId),
          }
        : VALORES_INICIALES
    )
  }, [open, unidad, reset])

  // Pre-llenar la sigla con la del padre cuando se crea una nueva unidad.
  useEffect(() => {
    if (esEdicion) return // En edicion no se pre-llena.
    if (padreIdSeleccionado === "") return

    const padreIdNum = parseInt(padreIdSeleccionado, 10)
    const padre = unidadesParaSelector.find((u) => u.id === padreIdNum)
    if (padre) {
      // Pre-llenar con sigla del padre para que el usuario solo complete su parte.
      setValue("sigla", padre.sigla + "/")
    }
  }, [padreIdSeleccionado, esEdicion, unidadesParaSelector, setValue])

  // Opciones del selector de padre. Excluir la unidad actual y sus descendientes
  // para evitar ciclos (en edicion).
  const opcionesPadre = useMemo(() => {
    return [
      // Sin padre = unidad de primer nivel. Va como una opcion mas del
      // combobox (no hay `defaultOption` como en SelectField).
      { value: "", label: "Oficina Inicial (raiz)" },
      ...unidadesParaSelector
        .filter((u) => !esEdicion || u.id !== unidad?.id)
        .map((u) => ({
          value: String(u.id),
          label: `${u.nombreIndentado} (${u.sigla})`,
          // La sigla ya esta en el label, pero el nombre indentado trae guiones
          // de jerarquia: se repite para que la busqueda por sigla sea directa.
          busqueda: u.sigla,
        })),
    ]
  }, [unidadesParaSelector, esEdicion, unidad])

  async function onSubmit(values: UnidadFormValues) {
    try {
      const payload = {
        nombre: values.nombre,
        sigla: values.sigla,
        activo: values.activo,
        padreId: padreIdToPayload(values.padreId),
      }

      if (esEdicion) {
        await actualizar.mutateAsync({ id: unidad.id, ...payload })
      } else {
        await crear.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion; el dialogo se queda abierto
      // para que el usuario pueda corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar unidad" : "Nueva unidad"}
          </DialogTitle>
          <DialogDescription>
            Area administrativa de la institucion (ej. Unidad de Planificacion).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <ComboboxField
              name="padreId"
              label="Depende de"
              control={control}
              options={opcionesPadre}
              placeholder="Seleccionar unidad padre..."
              vacio="No hay unidades que coincidan."
              disabled={guardando || cargandoUnidades}
              required={false}
            />

            <InputField
              name="nombre"
              label="Nombre"
              control={control}
              placeholder="Unidad de Planificacion"
              disabled={guardando}
            />

            <InputField
              name="sigla"
              label="Sigla"
              control={control}
              placeholder="DAF/UP/"
              disabled={guardando}
              description={
                esEdicion
                  ? "La sigla es jerarquica: incluye las de sus ancestros."
                  : padreIdSeleccionado
                    ? "Completa la sigla despues de la barra del padre."
                    : "Sigla corta para identificar esta unidad."
              }
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
              <Button type="submit" disabled={guardando || cargandoUnidades}>
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
