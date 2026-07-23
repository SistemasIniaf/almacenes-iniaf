import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarProveedor,
  crearProveedor,
  desactivarProveedor,
  listarProveedores,
} from "@/features/proveedores/proveedores.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateProveedorPayload,
  QueryProveedores,
  UpdateProveedorPayload,
} from "@/features/proveedores/proveedores.types"

export const proveedoresKeys = {
  all: ["proveedores"] as const,
  lista: (query: QueryProveedores) =>
    ["proveedores", "lista", query] as const,
}

export function useProveedores(query: QueryProveedores) {
  return useQuery({
    queryKey: proveedoresKeys.lista(query),
    queryFn: () => listarProveedores(query),
    placeholderData: keepPreviousData,
  })
}

/** Proveedores activos para los selectores (ordenados por nombre en el backend). */
export function useProveedoresActivos() {
  const query = {
    page: 1,
    pageSize: 100,
    activo: true,
    orden: "nombre" as const,
  }
  return useQuery({
    queryKey: proveedoresKeys.lista(query),
    queryFn: () => listarProveedores(query),
    select: (resultado) => resultado.data,
    staleTime: 5 * 60_000,
  })
}

function useInvalidarProveedores() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: proveedoresKeys.all })
}

export function useCrearProveedor() {
  const invalidar = useInvalidarProveedores()

  return useMutation({
    mutationFn: (payload: CreateProveedorPayload) => crearProveedor(payload),
    onSuccess: (proveedor) => {
      invalidar()
      toast.success(`Proveedor "${proveedor.nombre}" creado`)
    },
    // El error tipico es el 409 por NIT repetido, con el nombre del proveedor
    // que ya lo usa: se muestra tal cual lo manda el backend.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarProveedor() {
  const invalidar = useInvalidarProveedores()

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateProveedorPayload & { id: number }) =>
      actualizarProveedor(id, payload),
    onSuccess: (proveedor) => {
      invalidar()
      toast.success(`Proveedor "${proveedor.nombre}" actualizado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarProveedor() {
  const invalidar = useInvalidarProveedores()

  return useMutation({
    mutationFn: (id: number) => desactivarProveedor(id),
    onSuccess: (proveedor) => {
      invalidar()
      toast.success(`Proveedor "${proveedor.nombre}" desactivado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
