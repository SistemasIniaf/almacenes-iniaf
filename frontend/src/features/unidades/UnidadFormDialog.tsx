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
import { SelectField } from "@/components/form/SelectField"
import {
  NUEVO_GRUPO,
  padreIdToForm,
  padreIdToPayload,
  resolverGrupo,
  unidadSchema,
} from "@/features/unidades/unidades.schema"
import {
  useActualizarUnidad,
  useCrearUnidad,
  useGruposUnidades,
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
  grupo: "",
  grupoNuevo: "",
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
  const { data: grupos = [] } = useGruposUnidades()

  const { control, handleSubmit, reset, watch, setValue } =
    useForm<UnidadFormValues>({
      resolver: zodResolver(unidadSchema(esEdicion)),
      defaultValues: VALORES_INICIALES,
    })

  const padreIdSeleccionado = watch("padreId")
  const grupoSeleccionado = watch("grupo")
  const esRaiz = padreIdSeleccionado === ""

  // Opciones del select de grupo: los existentes + "crear uno nuevo".
  const opcionesGrupo = [
    ...grupos.map((g) => ({ value: g, label: g })),
    { value: NUEVO_GRUPO, label: "➕ Nuevo grupo…" },
  ]

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
            grupo: unidad.grupo ?? "",
            grupoNuevo: "",
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
      const base = {
        nombre: values.nombre,
        sigla: values.sigla,
        activo: values.activo,
        padreId: padreIdToPayload(values.padreId),
      }

      if (esEdicion) {
        // El grupo no se cambia en edición.
        await actualizar.mutateAsync({ id: unidad.id, ...base })
      } else {
        // Solo la raíz manda grupo; el hijo lo hereda del padre en el backend.
        await crear.mutateAsync(
          esRaiz ? { ...base, grupo: resolverGrupo(values) } : base
        )
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

            {/* Grupo: solo la raíz lo elige; el hijo lo hereda; en edición no cambia. */}
            {!esEdicion && esRaiz && (
              <>
                <SelectField
                  name="grupo"
                  label="Grupo"
                  control={control}
                  options={opcionesGrupo}
                  placeholder="Elegí un grupo"
                  disabled={guardando}
                  description="Categoría de la unidad. Las unidades hijas heredan este grupo."
                />
                {grupoSeleccionado === NUEVO_GRUPO && (
                  <InputField
                    name="grupoNuevo"
                    label="Nombre del grupo nuevo"
                    control={control}
                    placeholder="MOF"
                    disabled={guardando}
                    mayusculas
                  />
                )}
              </>
            )}

            {!esEdicion && !esRaiz && (
              <p className="text-sm text-muted-foreground">
                Hereda el grupo de su unidad padre.
              </p>
            )}

            {esEdicion && unidad?.grupo && (
              <p className="text-sm text-muted-foreground">
                Grupo:{" "}
                <span className="font-medium text-foreground">
                  {unidad.grupo}
                </span>{" "}
                (no se cambia al editar)
              </p>
            )}

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
