import { api } from "@/lib/api"

import type { LogoClave, LogosVigentes } from "@/lib/logos"

/**
 * Reemplaza un logo. Sin `Content-Type` a mano: axios arma el multipart con su
 * boundary al detectar un FormData (ver el comentario en `lib/api.ts`).
 */
export async function reemplazarLogo(
  clave: LogoClave,
  archivo: File
): Promise<LogosVigentes> {
  const formData = new FormData()
  formData.append("imagen", archivo)
  const { data } = await api.post<LogosVigentes>(`/logos/${clave}`, formData)
  return data
}

/** Vuelve al logo original de la aplicación. El historial se conserva. */
export async function restaurarLogo(clave: LogoClave): Promise<LogosVigentes> {
  const { data } = await api.delete<LogosVigentes>(`/logos/${clave}`)
  return data
}

/** Una versión del historial: cada logo que se subió, vigente o no. */
export interface LogoVersion {
  id: number
  clave: LogoClave
  url: string
  subidoEn: string
  subidoPor: string | null
  vigente: boolean
}

export async function obtenerHistorial(): Promise<LogoVersion[]> {
  const { data } = await api.get<LogoVersion[]>("/logos/historial")
  return data
}

/** Vuelve a poner vigente una versión del historial. */
export async function usarVersion(id: number): Promise<LogosVigentes> {
  const { data } = await api.post<LogosVigentes>(`/logos/versiones/${id}/usar`)
  return data
}

/** Borra una versión del historial, archivo incluido (nunca la vigente). */
export async function eliminarVersion(id: number): Promise<LogoVersion[]> {
  const { data } = await api.delete<LogoVersion[]>(`/logos/versiones/${id}`)
  return data
}
