import { queryOptions, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { urlArchivo } from "@/lib/files"

/**
 * Logos institucionales: cuál rige en cada lugar del sistema.
 *
 * Vive en `lib/` y no en el feature `logos` porque lo consumen piezas que no son
 * de ese feature —el login, el menú lateral y la base de los PDF y Excel—; el
 * feature solo aporta la pantalla para cambiarlos.
 *
 * Regla: un casillero sin logo subido usa el ORIGINAL que viene con la app
 * (`public/iniaf/`). Por eso «restaurar» en el backend es borrar, y por eso si
 * la API no responde todo sigue mostrando los logos de siempre.
 */

/** Espejo del enum `LogoClave` del backend. */
export type LogoClave = "INIAF" | "INIAF_OSCURO" | "MINISTERIO"

export interface LogoVigente {
  /** Ruta relativa del logo subido, o `null` si rige el original. */
  url: string | null
  actualizadoEn: string | null
  actualizadoPor: string | null
}

export type LogosVigentes = Record<LogoClave, LogoVigente>

/** Los que vienen con la app. Son también los que usan los PDF por defecto. */
export const LOGOS_ORIGINALES: Record<LogoClave, string> = {
  INIAF: "/iniaf/logo-iniaf.png",
  INIAF_OSCURO: "/iniaf/dark.png",
  MINISTERIO: "/iniaf/logo-ministerio.png",
}

export const logosKeys = { all: ["logos"] as const }

export async function obtenerLogos(): Promise<LogosVigentes> {
  const { data } = await api.get<LogosVigentes>("/logos")
  return data
}

/**
 * Una sola definición de la consulta para el hook y para `fetchQuery` (los PDF
 * la piden fuera de React): así comparten caché y un cambio de logo invalida
 * los dos a la vez. Cinco minutos de vigencia: a quien tenga el sistema abierto
 * el logo nuevo le llega solo, sin recargar.
 */
export const logosQueryOptions = queryOptions({
  queryKey: logosKeys.all,
  queryFn: obtenerLogos,
  staleTime: 5 * 60_000,
})

/** URL lista para `<img src>` o `fetch`: el subido, o si no hay, el original. */
export function urlLogo(
  logos: LogosVigentes | undefined,
  clave: LogoClave
): string {
  return urlArchivo(logos?.[clave]?.url) ?? LOGOS_ORIGINALES[clave]
}

/**
 * Logos vigentes para la UI. `listo` es falso SOLO mientras viaja la primera
 * consulta: quien dibuja un logo espera a `listo` para no mostrar el original
 * un instante y saltar al reemplazado. Si la consulta falla queda listo igual,
 * con los originales.
 */
export function useLogos() {
  const { data, isPending } = useQuery(logosQueryOptions)
  return {
    listo: !isPending,
    url: (clave: LogoClave) => urlLogo(data, clave),
  }
}
