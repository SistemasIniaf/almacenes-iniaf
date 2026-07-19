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
import { TextareaField } from "@/components/form/TextareaField"
import { proveedorSchema } from "@/features/proveedores/proveedores.schema"
import {
  useActualizarProveedor,
  useCrearProveedor,
} from "@/features/proveedores/useProveedores"

import type { ProveedorFormValues } from "@/features/proveedores/proveedores.schema"
import type { Proveedor } from "@/features/proveedores/proveedores.types"

interface ProveedorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con proveedor = editar. */
  proveedor: Proveedor | null
}

const VALORES_INICIALES: ProveedorFormValues = {
  nombre: "",
  nit: "",
  telefono: "",
  contacto: "",
  direccion: "",
  activo: true,
}

/**
 * En CREATE los opcionales vacios se OMITEN: `CreateProveedorDto` marca el NIT
 * con `@IsNotEmpty`, asi que mandar "" da 400. En UPDATE, en cambio, "" es
 * justamente lo que limpia el campo (el service lo normaliza a null).
 */
function soloConValor(texto: string): string | undefined {
  const limpio = texto.trim()
  return limpio === "" ? undefined : limpio
}

export function ProveedorFormDialog({
  open,
  onOpenChange,
  proveedor,
}: ProveedorFormDialogProps) {
  const esEdicion = proveedor !== null
  const crear = useCrearProveedor()
  const actualizar = useActualizarProveedor()
  const guardando = crear.isPending || actualizar.isPending

  const { control, handleSubmit, reset } = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: VALORES_INICIALES,
  })

  useEffect(() => {
    if (!open) return
    reset(
      proveedor
        ? {
            nombre: proveedor.nombre,
            // Los null del backend se muestran como campo vacio.
            nit: proveedor.nit ?? "",
            telefono: proveedor.telefono ?? "",
            contacto: proveedor.contacto ?? "",
            direccion: proveedor.direccion ?? "",
            activo: proveedor.activo,
          }
        : VALORES_INICIALES
    )
  }, [open, proveedor, reset])

  async function onSubmit(valores: ProveedorFormValues) {
    try {
      if (esEdicion) {
        // Se mandan tal cual: "" limpia el campo.
        await actualizar.mutateAsync({
          id: proveedor.id,
          nombre: valores.nombre,
          nit: valores.nit,
          telefono: valores.telefono,
          contacto: valores.contacto,
          direccion: valores.direccion,
          activo: valores.activo,
        })
      } else {
        await crear.mutateAsync({
          nombre: valores.nombre,
          nit: soloConValor(valores.nit),
          telefono: soloConValor(valores.telefono),
          contacto: soloConValor(valores.contacto),
          direccion: soloConValor(valores.direccion),
          activo: valores.activo,
        })
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion (ej. NIT ya registrado); el
      // dialogo se queda abierto para corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
          <DialogDescription>
            Solo el nombre es obligatorio. El resto de los datos se pueden
            completar después.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <InputField
              name="nombre"
              label="Nombre o razón social"
              control={control}
              placeholder="Distribuidora La Paz S.R.L."
              disabled={guardando}
            />

            <InputField
              name="nit"
              label="NIT"
              control={control}
              required={false}
              placeholder="1023456789"
              description="Opcional, pero no puede repetirse entre proveedores."
              disabled={guardando}
            />

            <InputField
              name="contacto"
              label="Persona de contacto"
              control={control}
              required={false}
              placeholder="Juan Pérez"
              disabled={guardando}
            />

            <InputField
              name="telefono"
              label="Teléfono"
              control={control}
              required={false}
              placeholder="22334455"
              disabled={guardando}
            />

            <TextareaField
              name="direccion"
              label="Dirección"
              control={control}
              required={false}
              rows={2}
              placeholder="Av. Arce 1234, La Paz"
              disabled={guardando}
            />

            <CheckboxField
              name="activo"
              label="Activo"
              control={control}
              required={false}
              disabled={guardando}
              description="Los proveedores inactivos no aparecen al registrar un ingreso."
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
                {esEdicion ? "Guardar cambios" : "Crear proveedor"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
