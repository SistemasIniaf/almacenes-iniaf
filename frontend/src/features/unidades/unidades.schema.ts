import { z } from "zod"

/**
 * Refleja `CreateUnidadDto` / `UpdateUnidadDto` del backend (max 150 y 20).
 * Si cambian los `@MaxLength` alla, actualizar aca.
 *
 * Nota: `padreId` se maneja como string en el formulario (para el SelectField)
 * y se convierte a number | null al armar el payload.
 */
export const unidadSchema = z.object({
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
})

export type UnidadFormValues = z.infer<typeof unidadSchema>

/** Convierte el padreId de string a number | null para el payload del backend. */
export function padreIdToPayload(padreId: string): number | null {
  return padreId === "" ? null : parseInt(padreId, 10)
}

/** Convierte el padreId de number | null a string para el formulario. */
export function padreIdToForm(padreId: number | null): string {
  return padreId === null ? "" : String(padreId)
}
