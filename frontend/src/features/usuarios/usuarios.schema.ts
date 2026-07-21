import { z } from "zod"

import { ROLES } from "@/features/auth/lib/auth.types"
import {
  permiteObservados,
  requiereAlmacen,
  requiereCargo,
  requiereUnidad,
} from "@/features/usuarios/usuarios.types"

/**
 * Espejo de `CreateUsuarioDto`/`UpdateUsuarioDto` MAS las reglas por rol que el
 * backend valida en el service (`resolverCamposPorRol`), porque dependen del
 * valor de `rol` y class-validator no las expresa.
 *
 * `unidadId` y `almacenId` se manejan como string ("" = sin seleccion) porque es
 * lo que entrega el `<Select>`; la conversion a number ocurre al armar el payload.
 */
const base = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido"),
  cargo: z.string().trim(),
  usuario: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string(),
  rol: z.enum(ROLES, { message: "El rol es requerido" }),
  activo: z.boolean(),
  unidadId: z.string(),
  almacenId: z.string(),
  almacenesObservados: z.array(z.number()),
})

export type UsuarioFormValues = z.infer<typeof base>

/**
 * El schema depende de si se esta creando (password obligatorio) o editando
 * (password opcional: vacio = no cambiar), por eso es una funcion.
 */
export function usuarioSchema(esEdicion: boolean) {
  return base.superRefine((valores, ctx) => {
    // Password: requerido al crear; al editar, vacio significa "no cambiar".
    if (!esEdicion || valores.password.length > 0) {
      if (valores.password.length < 6) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "La contraseña debe tener al menos 6 caracteres",
        })
      }
    }

    // El cargo es obligatorio salvo para los roles administrativos, que no
    // ocupan un puesto en el organigrama.
    if (requiereCargo(valores.rol) && !valores.cargo) {
      ctx.addIssue({
        code: "custom",
        path: ["cargo"],
        message: "El cargo es requerido",
      })
    }

    if (requiereUnidad(valores.rol) && !valores.unidadId) {
      ctx.addIssue({
        code: "custom",
        path: ["unidadId"],
        message: "Este rol requiere una unidad",
      })
    }

    if (requiereAlmacen(valores.rol) && !valores.almacenId) {
      ctx.addIssue({
        code: "custom",
        path: ["almacenId"],
        message: "Este rol requiere un almacén",
      })
    }

    if (
      permiteObservados(valores.rol) &&
      valores.almacenesObservados.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["almacenesObservados"],
        message: "Seleccioná al menos un almacén a observar",
      })
    }
  })
}
