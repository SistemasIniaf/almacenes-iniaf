import { z } from "zod"

/**
 * Refleja `CreateUnidadDto` / `UpdateUnidadDto` del backend (max 150 y 20).
 * Si cambian los `@MaxLength` alla, actualizar aca.
 *
 * Nota: `padreId` se maneja como string en el formulario (para el SelectField)
 * y se convierte a number | null al armar el payload.
 */
/** Valor centinela del select "Grupo" para crear uno nuevo. */
export const NUEVO_GRUPO = "__nuevo__"

const base = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(150, "El nombre no puede superar los 150 caracteres"),
  sigla: z
    .string()
    .trim()
    .min(1, "La sigla es requerida")
    .max(20, "La sigla no puede superar los 20 caracteres"),
  activo: z.boolean(),
  /** "" = raiz (Oficina Inicial); string numerico = id del padre. */
  padreId: z.string(),
  /** Grupo elegido en el select (un grupo existente o `NUEVO_GRUPO`). */
  grupo: z.string(),
  /** Nombre del grupo nuevo (solo si grupo === NUEVO_GRUPO). */
  grupoNuevo: z
    .string()
    .trim()
    .max(50, "El grupo no puede superar los 50 caracteres"),
})

export type UnidadFormValues = z.infer<typeof base>

/** Grupo final: el del select, o el escrito si se eligió "nuevo". */
export function resolverGrupo(valores: UnidadFormValues): string {
  return valores.grupo === NUEVO_GRUPO
    ? valores.grupoNuevo.trim()
    : valores.grupo
}

/**
 * El grupo es obligatorio solo al CREAR una unidad raíz (sin padre). En un hijo
 * lo hereda del padre, y en edición no se cambia, por eso es una función.
 */
export function unidadSchema(esEdicion: boolean) {
  return base.superRefine((valores, ctx) => {
    // El grupo solo importa al crear una unidad raíz.
    if (esEdicion || valores.padreId !== "") return

    if (!valores.grupo) {
      ctx.addIssue({
        code: "custom",
        path: ["grupo"],
        message: "Elegí un grupo",
      })
    } else if (valores.grupo === NUEVO_GRUPO && !valores.grupoNuevo.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["grupoNuevo"],
        message: "Escribí el nombre del grupo nuevo",
      })
    }
  })
}

/** Convierte el padreId de string a number | null para el payload del backend. */
export function padreIdToPayload(padreId: string): number | null {
  return padreId === "" ? null : parseInt(padreId, 10)
}

/** Convierte el padreId de number | null a string para el formulario. */
export function padreIdToForm(padreId: number | null): string {
  return padreId === null ? "" : String(padreId)
}
