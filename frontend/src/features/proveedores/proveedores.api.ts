import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  CreateProveedorPayload,
  Proveedor,
  QueryProveedores,
  UpdateProveedorPayload,
} from "@/features/proveedores/proveedores.types"

export async function listarProveedores(
  query: QueryProveedores
): Promise<PaginatedResult<Proveedor>> {
  const { data } = await api.get<PaginatedResult<Proveedor>>("/proveedores", {
    params: query,
  })
  return data
}

export async function obtenerProveedor(id: number): Promise<Proveedor> {
  const { data } = await api.get<Proveedor>(`/proveedores/${id}`)
  return data
}

export async function crearProveedor(
  payload: CreateProveedorPayload
): Promise<Proveedor> {
  const { data } = await api.post<Proveedor>("/proveedores", payload)
  return data
}

export async function actualizarProveedor(
  id: number,
  payload: UpdateProveedorPayload
): Promise<Proveedor> {
  const { data } = await api.patch<Proveedor>(`/proveedores/${id}`, payload)
  return data
}

/**
 * Baja logica. Nunca se borra fisicamente: el proveedor queda referenciado por
 * los Ingresos y eliminarlo rompería el Kardex.
 */
export async function desactivarProveedor(id: number): Promise<Proveedor> {
  const { data } = await api.delete<Proveedor>(`/proveedores/${id}`)
  return data
}
