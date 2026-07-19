import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarAlmacen,
  crearAlmacen,
  desactivarAlmacen,
  listarAlmacenes,
} from "@/features/almacenes/almacenes.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateAlmacenPayload,
  QueryAlmacenes,
  UpdateAlmacenPayload,
} from "@/features/almacenes/almacenes.types"

export const almacenesKeys = {
  all: ["almacenes"] as const,
  lista: (query: QueryAlmacenes) => ["almacenes", "lista", query] as const,
}

export function useAlmacenes(query: QueryAlmacenes) {
  return useQuery({
    queryKey: almacenesKeys.lista(query),
    queryFn: () => listarAlmacenes(query),
    placeholderData: keepPreviousData,
  })
}

/**
 * Almacenes activos para poblar selectores (ej. el formulario de usuarios).
 * Son 9+ en total: una sola pagina alcanza de sobra.
 */
export function useAlmacenesActivos() {
  return useQuery({
    queryKey: almacenesKeys.lista({ page: 1, pageSize: 100, activo: true }),
    queryFn: () => listarAlmacenes({ page: 1, pageSize: 100, activo: true }),
    select: (resultado) => resultado.data,
    staleTime: 5 * 60_000,
  })
}

function useInvalidarAlmacenes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: almacenesKeys.all })
}

export function useCrearAlmacen() {
  const invalidar = useInvalidarAlmacenes()

  return useMutation({
    mutationFn: (payload: CreateAlmacenPayload) => crearAlmacen(payload),
    onSuccess: (almacen) => {
      invalidar()
      toast.success(`Almacén "${almacen.nombre}" creado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarAlmacen() {
  const invalidar = useInvalidarAlmacenes()

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateAlmacenPayload & { id: number }) =>
      actualizarAlmacen(id, payload),
    onSuccess: (almacen) => {
      invalidar()
      toast.success(`Almacén "${almacen.nombre}" actualizado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarAlmacen() {
  const invalidar = useInvalidarAlmacenes()

  return useMutation({
    mutationFn: (id: number) => desactivarAlmacen(id),
    onSuccess: (almacen) => {
      invalidar()
      toast.success(`Almacén "${almacen.nombre}" desactivado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
