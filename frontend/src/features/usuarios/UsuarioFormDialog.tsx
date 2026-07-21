import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { CheckboxField } from "@/components/form/CheckboxField"
import { ComboboxField } from "@/components/form/ComboboxField"
import { InputField } from "@/components/form/InputField"
import { InputPasswordField } from "@/components/form/InputPasswordField"
import { SelectField } from "@/components/form/SelectField"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { ROLES, ROL_LABEL } from "@/features/auth/lib/auth.types"
import { useUnidadesActivas } from "@/features/unidades/useUnidades"
import { usuarioSchema } from "@/features/usuarios/usuarios.schema"
import {
  permiteObservados,
  requiereAlmacen,
  requiereUnidad,
} from "@/features/usuarios/usuarios.types"
import {
  useActualizarUsuario,
  useCrearUsuario,
} from "@/features/usuarios/useUsuarios"

import type { Rol } from "@/features/auth/lib/auth.types"
import type { UsuarioFormValues } from "@/features/usuarios/usuarios.schema"
import type {
  CreateUsuarioPayload,
  Usuario,
} from "@/features/usuarios/usuarios.types"

interface UsuarioFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con usuario = editar. */
  usuario: Usuario | null
}

const VALORES_INICIALES: UsuarioFormValues = {
  nombre: "",
  cargo: "",
  usuario: "",
  password: "",
  rol: "solicitador",
  activo: true,
  unidadId: "",
  almacenId: "",
  almacenesObservados: [],
}

const OPCIONES_ROL = ROLES.map((rol) => ({
  value: rol,
  label: ROL_LABEL[rol],
}))

/** Ayuda del campo Almacén según el rol (solo se muestra para los que lo llevan). */
const DESC_ALMACEN: Partial<Record<Rol, string>> = {
  solicitador: "Es el almacén destino fijo de sus egresos.",
  aprobador: "Almacén al que queda asociado el aprobador.",
  responsable_almacen: "Solo puede haber un responsable activo por almacén.",
  central: "Solo puede haber un central activo por almacén.",
}

export function UsuarioFormDialog({
  open,
  onOpenChange,
  usuario,
}: UsuarioFormDialogProps) {
  const esEdicion = usuario !== null
  const crear = useCrearUsuario()
  const actualizar = useActualizarUsuario()
  const guardando = crear.isPending || actualizar.isPending

  const { data: unidades = [] } = useUnidadesActivas()
  const { data: almacenes = [] } = useAlmacenesActivos()

  const { control, handleSubmit, reset } = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioSchema(esEdicion)),
    defaultValues: VALORES_INICIALES,
  })

  // Los campos de unidad/almacen/observados dependen del rol elegido.
  const rol = useWatch({ control, name: "rol" })

  useEffect(() => {
    if (!open) return
    reset(
      usuario
        ? {
            nombre: usuario.nombre,
            cargo: usuario.cargo ?? "",
            usuario: usuario.usuario,
            password: "",
            rol: usuario.rol,
            activo: usuario.activo,
            unidadId: usuario.unidadId ? String(usuario.unidadId) : "",
            almacenId: usuario.almacenId ? String(usuario.almacenId) : "",
            almacenesObservados: usuario.almacenesObservados.map(
              (observado) => observado.almacen.id
            ),
          }
        : VALORES_INICIALES
    )
  }, [open, usuario, reset])

  async function onSubmit(valores: UsuarioFormValues) {
    // El payload se arma SEGUN EL ROL: el backend rechaza con 400 si llega una
    // unidad/almacen para un rol que no los lleva, y el formulario puede tener
    // valores viejos de un rol elegido antes.
    const payload: CreateUsuarioPayload = {
      nombre: valores.nombre,
      cargo: valores.cargo || null,
      usuario: valores.usuario,
      password: valores.password,
      rol: valores.rol,
      activo: valores.activo,
      unidadId: requiereUnidad(valores.rol) ? Number(valores.unidadId) : null,
      almacenId: requiereAlmacen(valores.rol)
        ? Number(valores.almacenId)
        : null,
      almacenesObservados: permiteObservados(valores.rol)
        ? valores.almacenesObservados
        : [],
    }

    try {
      if (esEdicion) {
        // Password vacio = no se cambia: no debe viajar en el PATCH.
        const { password, ...resto } = payload
        await actualizar.mutateAsync({
          id: usuario.id,
          ...resto,
          ...(password ? { password } : {}),
        })
      } else {
        await crear.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch {
      // El toast de error lo emite la mutacion (username en uso, rol unico ya
      // ocupado...); el dialogo se queda abierto para corregir.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar usuario" : "Nuevo usuario"}
          </DialogTitle>
          <DialogDescription>
            Los usuarios se crean únicamente desde acá: no hay registro público.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Dos columnas en pantallas medianas; los bloques anchos (lista de
              observados, activo y footer) ocupan el ancho completo. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {requiereAlmacen(rol) && (
              <ComboboxField
                name="almacenId"
                label="Almacén"
                control={control}
                placeholder="Seleccioná un almacén"
                vacio="No se encontró ningún almacén."
                disabled={guardando}
                className="sm:col-span-2"
                options={almacenes.map((almacen) => ({
                  value: String(almacen.id),
                  label: almacen.nombre,
                }))}
                description={DESC_ALMACEN[rol]}
              />
            )}

            <SelectField
              name="rol"
              label="Rol"
              control={control}
              options={OPCIONES_ROL}
              placeholder="Seleccioná un rol"
              disabled={guardando}
              className="sm:col-span-2"
            />

            <InputField
              name="nombre"
              label="Nombre completo"
              control={control}
              placeholder="Juan Pérez"
              disabled={guardando}
            />

            <InputField
              name="cargo"
              label="Cargo"
              control={control}
              placeholder="Jefe de Unidad"
              disabled={guardando}
              required={false}
            />

            {requiereUnidad(rol) && (
              <ComboboxField
                name="unidadId"
                label="Unidad"
                control={control}
                placeholder="Seleccioná una unidad"
                vacio="No se encontró ninguna unidad."
                disabled={guardando}
                className="sm:col-span-2"
                options={unidades.map((unidad) => ({
                  value: String(unidad.id),
                  label: unidad.nombre,
                }))}
                description={
                  rol === "aprobador"
                    ? "Solo puede haber un aprobador activo por unidad."
                    : undefined
                }
              />
            )}

            <InputField
              name="usuario"
              label="Usuario"
              control={control}
              placeholder="jperez"
              autoComplete="off"
              disabled={guardando}
            />

            <InputPasswordField
              name="password"
              label="Contraseña"
              control={control}
              required={!esEdicion}
              disabled={guardando}
              autoComplete="new-password"
              description={
                esEdicion
                  ? "Dejala vacía para no cambiar la contraseña actual."
                  : "Mínimo 6 caracteres."
              }
            />

            {permiteObservados(rol) && (
              <Controller
                name="almacenesObservados"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="gap-2 sm:col-span-2"
                  >
                    <FieldLabel>
                      Almacenes que observa
                      <span className="text-red-500">*</span>
                    </FieldLabel>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Este rol solo consulta (auditoría): elegí qué almacenes
                      puede ver.
                    </p>
                    <div className="flex max-h-48 flex-col gap-3 overflow-y-auto rounded-md border p-3">
                      {almacenes.map((almacen) => {
                        const marcado = field.value.includes(almacen.id)
                        return (
                          <label
                            key={almacen.id}
                            className="flex items-center gap-3 text-sm"
                          >
                            <Checkbox
                              checked={marcado}
                              disabled={guardando}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked === true
                                    ? [...field.value, almacen.id]
                                    : field.value.filter(
                                        (id) => id !== almacen.id
                                      )
                                )
                              }
                            />
                            {almacen.nombre}
                          </label>
                        )
                      })}
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}

            <CheckboxField
              name="activo"
              label="Activo"
              control={control}
              required={false}
              disabled={guardando}
              description="Un usuario inactivo no puede iniciar sesión y libera su cupo de rol único."
              className="sm:col-span-2"
            />

            <DialogFooter className="mt-2 sm:col-span-2">
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
                {esEdicion ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
