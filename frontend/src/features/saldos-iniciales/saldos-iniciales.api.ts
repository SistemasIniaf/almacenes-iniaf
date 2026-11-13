import { api } from "@/lib/api"

import type {
  ImportarSaldosPayload,
  ResultadoImportacion,
  ResultadoValidacion,
} from "@/features/saldos-iniciales/saldos-iniciales.types"

/** Revisa la planilla sin grabar nada. */
export async function validarSaldos(
  payload: ImportarSaldosPayload
): Promise<ResultadoValidacion> {
  const { data } = await api.post<ResultadoValidacion>(
    "/saldos-iniciales/validar",
    payload
  )
  return data
}

/** Importa todo o nada: lotes, sus ingresos de saldo inicial y el kardex. */
export async function importarSaldos(
  payload: ImportarSaldosPayload
): Promise<ResultadoImportacion> {
  const { data } = await api.post<ResultadoImportacion>(
    "/saldos-iniciales",
    payload
  )
  return data
}
