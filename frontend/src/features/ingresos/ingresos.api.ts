import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateIngresoPayload,
  Ingreso,
  IngresoListItem,
  QueryIngresos,
  UpdateIngresoPayload,
} from "@/features/ingresos/ingresos.types"

export async function listarIngresos(
  query: QueryIngresos
): Promise<PaginatedResult<IngresoListItem>> {
  const { data } = await api.get<PaginatedResult<IngresoListItem>>("/ingresos", {
    params: query,
  })
  return data
}

export async function obtenerIngreso(id: number): Promise<Ingreso> {
  const { data } = await api.get<Ingreso>(`/ingresos/${id}`)
  return data
}

/** Registra el ingreso definitivo: estampa el número, crea los lotes y el Kardex. */
export async function crearIngreso(
  payload: CreateIngresoPayload
): Promise<Ingreso> {
  const { data } = await api.post<Ingreso>("/ingresos", payload)
  return data
}

/** Edita solo la cabecera documental (no toca líneas ni stock). */
export async function actualizarIngreso(
  id: number,
  payload: UpdateIngresoPayload
): Promise<Ingreso> {
  const { data } = await api.patch<Ingreso>(`/ingresos/${id}`, payload)
  return data
}

/** Anula un ingreso confirmado (reversión en Kardex). */
export async function anularIngreso(
  id: number,
  motivo: string
): Promise<Ingreso> {
  const { data } = await api.post<Ingreso>(`/ingresos/${id}/anular`, { motivo })
  return data
}
