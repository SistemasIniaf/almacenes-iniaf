import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarIngreso,
  anularIngreso,
  crearIngreso,
  listarIngresos,
  obtenerIngreso,
} from "@/features/ingresos/ingresos.api"
import { obtenerAlmacen } from "@/features/almacenes/almacenes.api"
import { listarSolicitadores } from "@/features/usuarios/usuarios.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateIngresoPayload,
  QueryIngresos,
  UpdateIngresoPayload,
} from "@/features/ingresos/ingresos.types"

export const ingresosKeys = {
  all: ["ingresos"] as const,
  lista: (query: QueryIngresos) => ["ingresos", "lista", query] as const,
  detalle: (id: number) => ["ingresos", "detalle", id] as const,
}

export function useIngresos(query: QueryIngresos) {
  return useQuery({
    queryKey: ingresosKeys.lista(query),
    queryFn: () => listarIngresos(query),
    placeholderData: keepPreviousData,
  })
}

export function useIngreso(id: number | undefined) {
  return useQuery({
    queryKey: ingresosKeys.detalle(id ?? 0),
    queryFn: () => obtenerIngreso(id as number),
    enabled: id != null,
  })
}

function useInvalidarIngresos() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ingresosKeys.all })
}

export function useCrearIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: (payload: CreateIngresoPayload) => crearIngreso(payload),
    onSuccess: () => {
      invalidar()
      toast.success("Ingreso registrado")
    },
    // El backend lista lo que falta si no se puede registrar.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateIngresoPayload & { id: number }) =>
      actualizarIngreso(id, payload),
    onSuccess: () => {
      invalidar()
      toast.success("Cambios guardados")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useAnularIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      anularIngreso(id, motivo),
    onSuccess: () => {
      invalidar()
      toast.success("Ingreso anulado")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

// ---------------------------------------------------------------------------
// Selectores auxiliares del formulario
// ---------------------------------------------------------------------------

/** Solicitadores activos (para el selector de responsable / comisión de recepción). */
export function useSolicitadores() {
  return useQuery({
    queryKey: ["usuarios", "solicitadores"],
    queryFn: listarSolicitadores,
    staleTime: 5 * 60_000,
  })
}

/** Unidades que muestra un almacén (para el selector de unidad solicitante). */
export function useUnidadesDeAlmacen(almacenId: number | undefined) {
  return useQuery({
    queryKey: ["almacenes", "unidades", almacenId],
    queryFn: () => obtenerAlmacen(almacenId as number),
    select: (almacen) => almacen.unidades,
    enabled: almacenId != null,
    staleTime: 60_000,
  })
}
