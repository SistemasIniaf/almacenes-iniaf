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
import { fuenteFinanciamientoSchema } from "@/features/fuentes-financiamiento/fuentes-financiamiento.schema"
import {
  useActualizarFuente,
  useCrearFuente,
} from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"

import type { FuenteFinanciamientoFormValues } from "@/features/fuentes-financiamiento/fuentes-financiamiento.schema"
import type { FuenteFinanciamiento } from "@/features/fuentes-financiamiento/fuentes-financiamiento.types"

interface FuenteFinanciamientoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con fuente = editar. */
  fuente: FuenteFinanciamiento | null
}

const VALORES_INICIALES: FuenteFinanciamientoFormValues = {
  nombre: "",
  codigo: "",
  activo: true,
}

/**
 * En CREATE el código vacío se OMITE: `CreateFuenteFinanciamientoDto` lo marca
 * con `@IsNotEmpty`, así que mandar "" da 400. En UPDATE, en cambio, "" es
 * justamente lo que limpia el campo (el service lo normaliza a null).
 */
function soloConValor(texto: string): string | undefined {
  const limpio = texto.trim()
  return limpio === "" ? undefined : limpio
}

export function FuenteFinanciamientoFormDialog({
  open,
  onOpenChange,
  fuente,
}: FuenteFinanciamientoFormDialogProps) {
  const esEdicion = fuente !== null
  const crear = useCrearFuente()
  const actualizar = useActualizarFuente()
  const guardando = crear.isPending || actualizar.isPending

  const { control, handleSubmit, reset } =
    useForm<FuenteFinanciamientoFormValues>({
      resolver: zodResolver(fuenteFinanciamientoSchema),
      defaultValues: VALORES_INICIALES,
    })

  useEffect(() => {
    if (!open) return
    reset(
      fuente
        ? {
            nombre: fuente.nombre,
            // El null del backend se muestra como campo vacio.
            codigo: fuente.codigo ?? "",
            activo: fuente.activo,
          }
        : VALORES_INICIALES
    )
  }, [open, fuente, reset])

  async function onSubmit(valores: FuenteFinanciamientoFormValues) {
    try {
      if (esEdicion) {
        // Se manda tal cual: "" limpia el codigo.
        await actualizar.mutateAsync({
          id: fuente.id,
          nombre: valores.nombre,
          codigo: valores.codigo,
          activo: valores.activo,
        })
      } else {
        await crear.mutateAsync({
          nombre: valores.nombre,
          codigo: soloConValor(valores.codigo),
          activo: valores.activo,
        })
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion (ej. nombre ya registrado); el
      // dialogo se queda abierto para corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar fuente" : "Nueva fuente de financiamiento"}
          </DialogTitle>
          <DialogDescription>
            El origen de los recursos con que se compra (Recursos Específicos,
            Banco Mundial, programas TGN…). Se elige en la cabecera de cada
            ingreso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <InputField
              name="nombre"
              label="Nombre"
              control={control}
              placeholder="Banco Mundial"
              description="No puede repetirse entre fuentes."
              disabled={guardando}
            />

            <InputField
              name="codigo"
              label="Código"
              control={control}
              required={false}
              placeholder="BM-2026"
              description="Opcional. El que use el área financiera, si maneja uno."
              disabled={guardando}
            />

            <CheckboxField
              name="activo"
              label="Activa"
              control={control}
              required={false}
              disabled={guardando}
              description="Las fuentes inactivas no aparecen al registrar un ingreso."
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
                {esEdicion ? "Guardar cambios" : "Crear fuente"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
