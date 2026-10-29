import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  crearTraspaso,
  listarTraspasos,
  lotesDeAlmacen,
  obtenerTraspaso,
} from "@/features/traspasos/traspasos.api"
import { etiquetaNumero } from "@/features/traspasos/traspasos.types"
import { listarAlmacenes } from "@/features/almacenes/almacenes.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateTraspasoPayload,
  QueryTraspasos,
} from "@/features/traspasos/traspasos.types"

export const traspasosKeys = {
  all: ["traspasos"] as const,
  lista: (query: QueryTraspasos) => ["traspasos", "lista", query] as const,
  detalle: (id: number) => ["traspasos", "detalle", id] as const,
  lotes: (almacenId: number) => ["traspasos", "lotes", almacenId] as const,
}

export function useTraspasos(query: QueryTraspasos) {
  return useQuery({
    queryKey: traspasosKeys.lista(query),
    queryFn: () => listarTraspasos(query),
    placeholderData: keepPreviousData,
  })
}

export function useTraspaso(id: number | undefined) {
  return useQuery({
    queryKey: traspasosKeys.detalle(id ?? 0),
    queryFn: () => obtenerTraspaso(id as number),
    enabled: id != null,
  })
}

export function useLotesDeAlmacen(almacenId: number | undefined) {
  return useQuery({
    queryKey: traspasosKeys.lotes(almacenId ?? 0),
    queryFn: () => lotesDeAlmacen(almacenId as number),
    enabled: almacenId != null,
    // El disponible cambia con cada pedido: siempre fresco al elegir almacén.
    staleTime: 0,
  })
}

export function useCrearTraspaso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTraspasoPayload) => crearTraspaso(payload),
    onSuccess: (traspaso) => {
      // Mueve saldos en los dos almacenes: todo lo que muestra stock queda viejo.
      for (const clave of ["traspasos", "stock", "kardex", "egresos"]) {
        void queryClient.invalidateQueries({ queryKey: [clave] })
      }
      toast.success(`Traspaso ${etiquetaNumero(traspaso)} registrado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/**
 * TODOS los almacenes, con los dados de baja: el de origen de un traspaso suele
 * ser justamente uno que se cierra. `enabled` porque `GET /almacenes` no está
 * abierto al responsable de almacén.
 */
export function useTodosLosAlmacenes(enabled = true) {
  const query = { page: 1, pageSize: 100, orden: "nombre" as const }
  return useQuery({
    queryKey: ["almacenes", "lista", query],
    queryFn: () => listarAlmacenes(query),
    select: (resultado) => resultado.data,
    staleTime: 5 * 60_000,
    enabled,
  })
}
