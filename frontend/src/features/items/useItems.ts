import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarItem,
  crearItem,
  desactivarItem,
  listarItems,
  quitarImagenItem,
  subirImagenItem,
} from "@/features/items/items.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateItemPayload,
  QueryItems,
  UpdateItemPayload,
} from "@/features/items/items.types"

export const itemsKeys = {
  all: ["items"] as const,
  lista: (query: QueryItems) => ["items", "lista", query] as const,
}

export function useItems(query: QueryItems) {
  return useQuery({
    queryKey: itemsKeys.lista(query),
    queryFn: () => listarItems(query),
    placeholderData: keepPreviousData,
  })
}

function useInvalidarItems() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: itemsKeys.all })
}

export function useCrearItem() {
  const invalidar = useInvalidarItems()

  return useMutation({
    mutationFn: (payload: CreateItemPayload) => crearItem(payload),
    onSuccess: (item) => {
      invalidar()
      // El codigo lo genera el backend: mostrarlo confirma cual quedo asignado.
      toast.success(`Ítem ${item.codigo} creado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarItem() {
  const invalidar = useInvalidarItems()

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateItemPayload & { id: number }) =>
      actualizarItem(id, payload),
    onSuccess: (item) => {
      invalidar()
      toast.success(`Ítem ${item.codigo} actualizado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarItem() {
  const invalidar = useInvalidarItems()

  return useMutation({
    mutationFn: (id: number) => desactivarItem(id),
    onSuccess: (item) => {
      invalidar()
      toast.success(`Ítem ${item.codigo} desactivado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/** Sube o quita la imagen; ambas devuelven el ítem actualizado. */
export function useImagenItem() {
  const invalidar = useInvalidarItems()

  return useMutation({
    mutationFn: ({ id, archivo }: { id: number; archivo: File | null }) =>
      archivo ? subirImagenItem(id, archivo) : quitarImagenItem(id),
    onSuccess: (item, variables) => {
      invalidar()
      toast.success(
        variables.archivo
          ? `Imagen de ${item.codigo} actualizada`
          : `Imagen de ${item.codigo} eliminada`
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
