import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateIngresoPayload,
  FilaReporteIngreso,
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

/**
 * Los ingresos del rango sin paginar, para el reporte imprimible. Se agrega en
 * el servidor por la misma razón que el de stock: un reporte no se pagina.
 */
export async function reporteIngresos(
  query: QueryIngresos
): Promise<FilaReporteIngreso[]> {
  const { data } = await api.get<FilaReporteIngreso[]>("/ingresos/reporte", {
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

/**
 * Sube (o reemplaza) la foto de UN lote. El campo multipart se llama `imagen`.
 * No se fija el Content-Type: axios lo arma con el boundary correcto al detectar
 * un FormData (ver el comentario en `lib/api.ts`).
 *
 * Funciona con el ingreso ya confirmado, a diferencia del resto de la línea: la
 * foto no mueve saldo ni correlativo, así que el almacén puede registrar el
 * ingreso apenas llega el material y cargar las fotos después.
 */
export async function subirImagenLote(
  ingresoId: number,
  detalleId: number,
  archivo: File
): Promise<Ingreso> {
  const formData = new FormData()
  formData.append("imagen", archivo)

  const { data } = await api.post<Ingreso>(
    `/ingresos/${ingresoId}/detalles/${detalleId}/imagen`,
    formData
  )
  return data
}

/** Quita la foto del lote: vuelve a regir la del catálogo del ítem. */
export async function quitarImagenLote(
  ingresoId: number,
  detalleId: number
): Promise<Ingreso> {
  const { data } = await api.delete<Ingreso>(
    `/ingresos/${ingresoId}/detalles/${detalleId}/imagen`
  )
  return data
}
