import { useState } from "react"
import { Link } from "react-router-dom"
import { FileText, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { BadgeEstado } from "@/components/data/BadgeEstado"
import { DataPagination } from "@/components/data/DataPagination"
import { IconAction } from "@/components/data/IconAction"
import { TONO_ACCION } from "@/components/data/tonos-accion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { CerrarGestionDialog } from "@/features/cierres/CerrarGestionDialog"
import { CuadrosDgcf } from "@/features/cierres/CuadrosDgcf"
import { useActaCierre } from "@/features/cierres/useActaCierre"
import { useCierres, useEstadoCierres } from "@/features/cierres/useCierres"
import { ESTADO_LABEL } from "@/features/egresos/egresos.types"
import { usePagination } from "@/hooks/use-pagination"
import { getApiErrorMessage } from "@/lib/api"
import { moneda, numeroDocumento } from "@/lib/formato"

import type { EstadoAlmacen } from "@/features/cierres/cierres.types"

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/** Cuántos pedidos se nombran en la fila; el resto se resume. */
const PEDIDOS_A_LA_VISTA = 5

/** Qué pasa con el almacén, en una línea. */
function Situacion({ fila }: { fila: EstadoAlmacen }) {
  if (fila.gestionPendiente == null) {
    return fila.ultimaCerrada == null ? (
      <BadgeEstado tono="neutro">Sin movimientos</BadgeEstado>
    ) : (
      <BadgeEstado tono="ok">Al día</BadgeEstado>
    )
  }
  if (fila.pedidosAbiertos.length > 0) {
    const n = fila.pedidosAbiertos.length
    return (
      <div className="space-y-1.5">
        <BadgeEstado tono="alto">
          {n} {n === 1 ? "pedido sin resolver" : "pedidos sin resolver"}
        </BadgeEstado>
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {fila.pedidosAbiertos.slice(0, PEDIDOS_A_LA_VISTA).map((p) => (
            <li key={p.id}>
              <Link
                to={`/egresos/${p.id}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {numeroDocumento(p)}
              </Link>{" "}
              · {ESTADO_LABEL[p.estado]} · {p.solicitante.nombre}
            </li>
          ))}
          {n > PEDIDOS_A_LA_VISTA && <li>y {n - PEDIDOS_A_LA_VISTA} más…</li>}
        </ul>
      </div>
    )
  }
  if (fila.anticipado) {
    return <BadgeEstado tono="espera">Gestión en curso</BadgeEstado>
  }
  return <BadgeEstado tono="proceso">Lista para cerrar</BadgeEstado>
}

/**
 * Cierre de gestión por almacén (2026-11-16). Arriba, qué gestión le toca
 * cerrar a cada almacén y qué lo traba; abajo, los cierres hechos con su acta.
 *
 * Cerrar es solo del super_admin; el admin ve todo pero sin el botón (mismo
 * criterio que usuarios). Los pedidos que traban el cierre se nombran con
 * enlace: resolverlos (entregar, devolver, desistir) es el paso previo.
 */
export function CierresPage() {
  const { user } = useAuth()
  const puedeCerrar = tienePermiso(user, "cierresEjecutar")

  const estado = useEstadoCierres()
  const [aCerrar, setACerrar] = useState<EstadoAlmacen | null>(null)

  const { page, pageSize, setPage, setPageSize } = usePagination()
  const cierres = useCierres({ page, pageSize })
  const { abrirActa, generandoId } = useActaCierre()

  const filas = estado.data?.almacenes ?? []
  const historial = cierres.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cierre de gestión
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada almacén cierra sus gestiones en orden. Para cerrar, todos los
          pedidos de esa gestión tienen que estar entregados o desistidos. Una
          gestión cerrada queda congelada y no se puede reabrir.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Gestiones por cerrar</h2>
        <div className="rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-center">Última cerrada</TableHead>
                <TableHead className="text-center">Le toca cerrar</TableHead>
                <TableHead>Situación</TableHead>
                {puedeCerrar && (
                  <TableHead className="text-right">Acción</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {estado.isPending &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: puedeCerrar ? 5 : 4 }).map(
                      (__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      )
                    )}
                  </TableRow>
                ))}

              {estado.isError && (
                <TableRow>
                  <TableCell
                    colSpan={puedeCerrar ? 5 : 4}
                    className="py-8 text-center text-sm text-destructive"
                  >
                    {getApiErrorMessage(
                      estado.error,
                      "No se pudo consultar el estado de los almacenes."
                    )}
                  </TableCell>
                </TableRow>
              )}

              {filas.map((fila) => {
                const trabado = fila.pedidosAbiertos.length > 0
                return (
                  <TableRow key={fila.almacen.id} className="align-top">
                    <TableCell className="min-w-56 leading-snug whitespace-normal">
                      {fila.almacen.nombre}
                      {!fila.almacen.activo && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (inactivo)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {fila.ultimaCerrada ?? "—"}
                    </TableCell>
                    <TableCell className="text-center font-semibold tabular-nums">
                      {fila.gestionPendiente ?? "—"}
                    </TableCell>
                    <TableCell className="w-full whitespace-normal">
                      <Situacion fila={fila} />
                    </TableCell>
                    {puedeCerrar && (
                      <TableCell className="text-right whitespace-nowrap">
                        {fila.gestionPendiente != null && (
                          <Button
                            size="sm"
                            variant={trabado ? "outline" : "default"}
                            disabled={trabado}
                            title={
                              trabado
                                ? "Primero hay que resolver los pedidos de la gestión"
                                : undefined
                            }
                            onClick={() => setACerrar(fila)}
                          >
                            <Lock className="size-4" />
                            Cerrar {fila.gestionPendiente}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Cuadros 5 y 6 (DGCF)</h2>
        <CuadrosDgcf />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Cierres realizados</h2>
        <div className="rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead>Gestión</TableHead>
                <TableHead>Cerrado el</TableHead>
                <TableHead>Por</TableHead>
                <TableHead className="text-right">Saldo final (Bs)</TableHead>
                <TableHead className="text-right">Acta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.isPending &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {cierres.isError && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-destructive"
                  >
                    {getApiErrorMessage(
                      cierres.error,
                      "No se pudieron cargar los cierres."
                    )}
                  </TableCell>
                </TableRow>
              )}

              {!cierres.isPending &&
                !cierres.isError &&
                historial.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Todavía no se cerró ninguna gestión.
                    </TableCell>
                  </TableRow>
                )}

              {historial.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="min-w-56 leading-snug whitespace-normal">
                    {c.almacen.nombre}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">
                      {c.gestion}
                    </span>
                    {c.anticipado && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        anticipado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {fechaHora(c.cerradoEn)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {c.cerradoPor.nombre}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {moneda(c.valorFinal)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <IconAction
                      icono={generandoId === c.id ? Loader2 : FileText}
                      cargando={generandoId === c.id}
                      etiqueta="Ver el acta en PDF"
                      onClick={() => void abrirActa(c.id)}
                      disabled={generandoId != null}
                      className={TONO_ACCION.pdf}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {cierres.data && (
          <DataPagination
            meta={cierres.data.meta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entidad="cierres"
          />
        )}
      </section>

      {aCerrar && (
        <CerrarGestionDialog
          fila={aCerrar}
          onClose={() => setACerrar(null)}
          onCerrado={(cierre) =>
            // El acta se ofrece en el toast: abrirla necesita el gesto de un
            // clic, o el navegador bloquea la pestaña.
            toast.success(
              `Gestión ${cierre.gestion} de ${cierre.almacen.nombre} cerrada`,
              {
                duration: 15_000,
                action: {
                  label: "Ver acta",
                  onClick: () => void abrirActa(cierre.id),
                },
              }
            )
          }
        />
      )}
    </div>
  )
}
