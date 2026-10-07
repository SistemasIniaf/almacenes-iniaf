import { urlBaseApi } from "@/lib/api"

/**
 * Las imagenes subidas se sirven como estaticas publicas bajo `/uploads`, FUERA
 * del prefijo de la API (`/api/v1`) y del guard de JWT — por eso hay que armar
 * la URL contra el ORIGEN del backend, no contra la base de la API completa.
 * `urlBaseApi()` resuelve a `VITE_API_URL` en dev o a `window.location.origin`
 * en el build de producción (ver su comentario en `lib/api.ts`); en los dos
 * casos es una URL ABSOLUTA, que es lo que `new URL(...)` necesita.
 */
const ORIGEN_BACKEND = new URL(urlBaseApi()).origin

/** Convierte la ruta relativa que guarda la DB en una URL absoluta usable en <img>. */
export function urlArchivo(ruta: string | null | undefined): string | null {
  if (!ruta) return null
  return `${ORIGEN_BACKEND}${ruta}`
}

/** Límites de subida — deben coincidir con `uploads.config.ts` del backend. */
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024
export const MIME_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"]

/** Valida el archivo antes de subirlo; devuelve el error o null si está bien. */
export function validarImagen(archivo: File): string | null {
  if (!MIME_IMAGEN_PERMITIDOS.includes(archivo.type)) {
    return "Formato no permitido. Usá JPG, PNG o WebP."
  }
  if (archivo.size > MAX_IMAGEN_BYTES) {
    return "La imagen no puede superar los 5 MB."
  }
  return null
}
