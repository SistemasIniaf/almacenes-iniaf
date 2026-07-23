import type { PaginationQuery } from "@/lib/types"

export interface Proveedor {
  id: number
  /** NO es único: la razón social se escribe de formas distintas. */
  nombre: string
  /** Opcional pero único si tiene valor; conviven varios proveedores sin NIT. */
  nit: string | null
  telefono: string | null
  contacto: string | null
  direccion: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
}

/** Espejo de `QueryProveedoresDto`: `q` busca en nombre, nit y contacto. */
export interface QueryProveedores extends PaginationQuery {
  activo?: boolean
  /** `nombre` = alfabético (selectores); sin él, por fecha (listados). */
  orden?: "nombre"
}

export interface CreateProveedorPayload {
  nombre: string
  nit?: string
  telefono?: string
  contacto?: string
  direccion?: string
  activo?: boolean
}

/**
 * En update los opcionales SÍ admiten cadena vacía: es la forma de limpiarlos
 * (el service la normaliza a null). En create, en cambio, hay que omitirlos.
 */
export interface UpdateProveedorPayload {
  nombre?: string
  nit?: string
  telefono?: string
  contacto?: string
  direccion?: string
  activo?: boolean
}
