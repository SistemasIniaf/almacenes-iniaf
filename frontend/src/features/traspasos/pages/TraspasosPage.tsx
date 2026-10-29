import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Eye, FileText, Loader2, Plus } from "lucide-react"

import { DataPagination } from "@/components/data/DataPagination"
import { IconAction } from "@/components/data/IconAction"
import { NumeroDocumento } from "@/components/data/NumeroDocumento"
import { TONO_ACCION } from "@/components/data/tonos-accion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useNotaTraspaso } from "@/features/traspasos/hooks/useNotaTraspaso"
import {
  useTodosLosAlmacenes,
  useTraspasos,
} from "@/features/traspasos/hooks/useTraspasos"
import { usePagination } from "@/hooks/use-pagination"
import { getApiErrorMessage } from "@/lib/api"
import { moneda } from "@/lib/formato"

const TODOS = "todos"
const COLUMNAS = 8

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

export function TraspasosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "traspasosEscribir")
  // Mismo criterio que ingresos: el filtro de almacén solo para quien ve varios.
  const veVariosAlmacenes =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "observador_almacen"

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [almacenId, setAlmacenId] = useState<string>(TODOS)
  const { abrirNota, generandoId } = useNotaTraspaso()

  // Con los dados de baja: un almacén cerrado sigue teniendo sus traspasos.
  const { data: almacenes = [] } = useTodosLosAlmacenes(veVariosAlmacenes)

  const { data, isPending, isError, error } = useTraspasos({
    almacenId: almacenId === TODOS ? undefined : Number(almacenId),
    page,
    pageSize,
  })
  const traspasos = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Traspasos</h1>
          <p className="text-sm text-muted-foreground">
            Material que pasó de un almacén a otro —por ejemplo, al cerrar un
            almacén—, con el mismo precio y la misma fuente de financiamiento.
          </p>
        </div>
        {puedeEscribir && (
          <Button onClick={() => navigate("/traspasos/nuevo")}>
            <Plus className="size-4" />
            Nuevo traspaso
          </Button>
        )}
      </div>

      {veVariosAlmacenes && (
        <div className="flex">
          <Select
            value={almacenId}
            onValueChange={(v) => {
              setAlmacenId(v)
              resetPage()
            }}
          >
            <SelectTrigger className="sm:w-72" aria-label="Filtrar por almacén">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={TODOS}>Todos los almacenes</SelectItem>
              {almacenes.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.nombre}
                  {!a.activo && " (inactivo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Lotes</TableHead>
              <TableHead className="text-right">Total (Bs)</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 4 }).map((_, fila) => (
                <TableRow key={fila}>
                  {Array.from({ length: COLUMNAS }).map((__, celda) => (
                    <TableCell key={celda}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell
                  colSpan={COLUMNAS}
                  className="py-8 text-center text-sm text-destructive"
                >
                  {getApiErrorMessage(
                    error,
                    "No se pudieron cargar los traspasos."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && traspasos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMNAS}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {almacenId !== TODOS
                    ? "Ese almacén no tiene traspasos."
                    : "Todavía no hay traspasos registrados."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              traspasos.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/traspasos/${t.id}`)}
                >
                  <TableCell className="whitespace-nowrap">
                    <NumeroDocumento numero={t.numero} gestion={t.gestion} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {fecha(t.fecha)}
                  </TableCell>
                  {/* Con ancho mínimo propio: el Motivo absorbe el sobrante
                      (`w-full max-w-0`) y, sin esto, los nombres de almacén
                      —largos— se partían en una palabra por renglón. */}
                  <TableCell className="min-w-56 leading-snug whitespace-normal">
                    {t.almacenOrigen.nombre}
                  </TableCell>
                  <TableCell className="min-w-56 leading-snug whitespace-normal">
                    <div className="flex items-start gap-1.5">
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {t.almacenDestino.nombre}
                    </div>
                  </TableCell>
                  <TableCell className="w-full max-w-0 text-xs leading-snug whitespace-normal text-muted-foreground">
                    {t.observacion}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.lineas}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {moneda(t.total)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconAction
                      icono={Eye}
                      etiqueta="Ver"
                      onClick={() => navigate(`/traspasos/${t.id}`)}
                      className={TONO_ACCION.ver}
                    />
                    <IconAction
                      icono={generandoId === t.id ? Loader2 : FileText}
                      cargando={generandoId === t.id}
                      etiqueta="Ver la nota en PDF"
                      onClick={() => void abrirNota(t.id)}
                      disabled={generandoId != null}
                      className={TONO_ACCION.pdf}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          meta={data.meta}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entidad="traspasos"
        />
      )}
    </div>
  )
}
