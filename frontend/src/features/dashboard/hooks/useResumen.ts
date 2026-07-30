import { useQuery } from "@tanstack/react-query"

import { listarEgresos } from "@/features/egresos/egresos.api"
import { egresosKeys } from "@/features/egresos/hooks/useEgresos"
import { listarIngresos } from "@/features/ingresos/ingresos.api"
import { ingresosKeys } from "@/features/ingresos/hooks/useIngresos"

import type { QueryEgresos } from "@/features/egresos/egresos.types"
import type { QueryIngresos } from "@/features/ingresos/ingresos.types"

/**
 * Los contadores de la home salen del `meta.total` de los listados que ya
 * existen, pidiendo UNA fila. No hay endpoint de resumen y no hace falta
 * inventarlo: cada consulta ya aplica el alcance del rol en el backend, así que
 * "esperando entrega" significa lo correcto para cada quien —los de su almacén
 * para el responsable, los de su unidad para el aprobador, los suyos para el
 * solicitante— sin que la UI tenga que saberlo.
 *
 * `enabled` no es decorativo: un rol sin permiso sobre el módulo recibiría 403,
 * y la tarjeta ni siquiera se muestra.
 */
const SOLO_EL_TOTAL = { page: 1, pageSize: 1 } as const

export function useConteoEgresos(query: QueryEgresos, habilitado = true) {
  const completa = { ...query, ...SOLO_EL_TOTAL }
  return useQuery({
    // Misma key que el listado: si la pantalla de egresos ya pidió esto, se
    // reusa, y cualquier mutación de egresos lo invalida solo.
    queryKey: egresosKeys.lista(completa),
    queryFn: () => listarEgresos(completa),
    enabled: habilitado,
    select: (resultado) => resultado.meta.total,
  })
}

export function useConteoIngresos(query: QueryIngresos, habilitado = true) {
  const completa = { ...query, ...SOLO_EL_TOTAL }
  return useQuery({
    queryKey: ingresosKeys.lista(completa),
    queryFn: () => listarIngresos(completa),
    enabled: habilitado,
    select: (resultado) => resultado.meta.total,
  })
}
