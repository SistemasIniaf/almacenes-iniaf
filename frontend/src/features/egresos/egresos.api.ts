import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateEgresoPayload,
  Egreso,
  EgresoListItem,
  EntregaPayload,
  QueryEgresos,
  UpdateEgresoPayload,
} from "@/features/egresos/egresos.types"

export async function listarEgresos(
  query: QueryEgresos
): Promise<PaginatedResult<EgresoListItem>> {
  const { data } = await api.get<PaginatedResult<EgresoListItem>>("/egresos", {
    params: query,
  })
  return data
}

export async function obtenerEgreso(id: number): Promise<Egreso> {
  const { data } = await api.get<Egreso>(`/egresos/${id}`)
  return data
}

export async function crearEgreso(
  payload: CreateEgresoPayload
): Promise<Egreso> {
  const { data } = await api.post<Egreso>("/egresos", payload)
  return data
}

export async function actualizarEgreso(
  id: number,
  payload: UpdateEgresoPayload
): Promise<Egreso> {
  const { data } = await api.patch<Egreso>(`/egresos/${id}`, payload)
  return data
}

/**
 * Descarta un borrador. Se borra de verdad, a diferencia de todo lo demás del
 * sistema: todavía no es un documento (no tiene número) ni tocó stock.
 */
export async function descartarEgreso(id: number): Promise<void> {
  await api.delete(`/egresos/${id}`)
}

/** Lo manda al aprobador de unidad. Acá el backend estampa el correlativo. */
export async function enviarEgreso(id: number): Promise<Egreso> {
  const { data } = await api.post<Egreso>(`/egresos/${id}/enviar`)
  return data
}

/** Nivel 1: el aprobador de unidad. No ajusta cantidades. */
export async function aprobarEgreso(id: number): Promise<Egreso> {
  const { data } = await api.post<Egreso>(`/egresos/${id}/aprobar`)
  return data
}

/** Desde cualquiera de los dos niveles: vuelve al solicitante. */
export async function rechazarEgreso(
  id: number,
  motivo: string
): Promise<Egreso> {
  const { data } = await api.post<Egreso>(`/egresos/${id}/rechazar`, { motivo })
  return data
}

/** Nivel 2: descarga el stock y escribe la SALIDA en el Kardex. */
export async function entregarEgreso(
  id: number,
  payload: EntregaPayload
): Promise<Egreso> {
  const { data } = await api.post<Egreso>(`/egresos/${id}/entregar`, payload)
  return data
}

/** Devuelve el material a sus lotes + REVERSIÓN en el Kardex. */
export async function anularEgreso(
  id: number,
  motivo: string
): Promise<Egreso> {
  const { data } = await api.post<Egreso>(`/egresos/${id}/anular`, { motivo })
  return data
}
