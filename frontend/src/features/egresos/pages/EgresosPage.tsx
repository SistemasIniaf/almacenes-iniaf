import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Inbox, Plus, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { DataPagination } from "@/components/data/DataPagination"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useEgresos } from "@/features/egresos/hooks/useEgresos"
import {
  ESTADO_LABEL,
  ESTADO_VARIANT,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type { EstadoEgreso } from "@/features/egresos/egresos.types"

type FiltroEstado = EstadoEgreso | "todos"

const ESTADOS: EstadoEgreso[] = [
  "BORRADOR",
  "PENDIENTE_APROBADOR",
  "PENDIENTE_RESPONSABLE_ALMACEN",
  "ENTREGADO",
  "ANULADO",
]

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—"

export function EgresosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const puedeCrear = tienePermiso(user, "egresosCrear")

  // Quien decide algo en el circuito arranca en SU bandeja: lo que espera su
  // firma. El resto ve todo lo que le toca por alcance.
  const tieneBandeja =
    user?.rol === "aprobador" || user?.rol === "responsable_almacen"

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const [soloBandeja, setSoloBandeja] = useState(tieneBandeja)
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { data, isPending, isError, error } = useEgresos({
    page,
    pageSize,
    q: busquedaDiferida || undefined,
    estado: estado === "todos" ? undefined : estado,
    pendientesMios: soloBandeja || undefined,
  })

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  const egresos = data?.data ?? []
  const veVariasUnidades =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "responsable_almacen" ||
    user?.rol === "observador_almacen"
  const columnas = veVariasUnidades ? 7 : 6

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de material: los arma el solicitante, los aprueba el jefe de
            unidad y los entrega el responsable del almacén.
          </p>
        </div>

        {puedeCrear && (
          <Button onClick={() => navigate("/egresos/nuevo")}>
            <Plus className="size-4" />
            Nuevo pedido
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) =>
              cambiarFiltro(() => setBusqueda(event.target.value))
            }
            placeholder="Buscar por justificación..."
            className="pl-9"
            aria-label="Buscar egresos"
          />
        </div>

        {tieneBandeja && (
          <Button
            variant={soloBandeja ? "default" : "outline"}
            onClick={() => cambiarFiltro(() => setSoloBandeja(!soloBandeja))}
          >
            <Inbox className="size-4" />
            {soloBandeja ? "Solo mi bandeja" : "Todos"}
          </Button>
        )}

        <Select
          value={estado}
          onValueChange={(valor) =>
            cambiarFiltro(() => setEstado(valor as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS.map((valor) => (
              <SelectItem key={valor} value={valor}>
                {ESTADO_LABEL[valor]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha</TableHead>
              {veVariasUnidades && <TableHead>Unidad</TableHead>}
              <TableHead>Solicitante</TableHead>
              <TableHead>Justificación</TableHead>
              <TableHead className="text-center">Ítems</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }).map((_, fila) => (
                <TableRow key={fila}>
                  {Array.from({ length: columnas }).map((__, celda) => (
                    <TableCell key={celda}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-destructive"
                >
                  {getApiErrorMessage(error, "No se pudieron cargar los egresos.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && egresos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {soloBandeja
                    ? "No tenés pedidos esperando tu decisión."
                    : busquedaDiferida || estado !== "todos"
                      ? "Ningún pedido coincide con los filtros."
                      : "Todavía no hay pedidos."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              egresos.map((egreso) => (
                <TableRow
                  key={egreso.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/egresos/${egreso.id}`)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {etiquetaNumero(egreso)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fecha(egreso.fechaEnvio ?? egreso.createdAt)}
                  </TableCell>
                  {veVariasUnidades && (
                    <TableCell className="text-muted-foreground">
                      {egreso.unidad.sigla}
                    </TableCell>
                  )}
                  <TableCell>{egreso.solicitante.nombre}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {egreso.justificacion}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {egreso._count.detalles}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[egreso.estado]}>
                      {ESTADO_LABEL[egreso.estado]}
                    </Badge>
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
          entidad="egresos"
        />
      )}
    </div>
  )
}
