import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, Loader2, Plus, Printer, Search, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { IconAction } from "@/components/data/IconAction"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import {
  useEliminarIngreso,
  useIngresos,
} from "@/features/ingresos/hooks/useIngresos"
import { useNotaIngreso } from "@/features/ingresos/hooks/useNotaIngreso"
import {
  ESTADO_LABEL,
  etiquetaNumero,
} from "@/features/ingresos/ingresos.types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type {
  EstadoIngreso,
  IngresoListItem,
} from "@/features/ingresos/ingresos.types"

type FiltroEstado = EstadoIngreso | "todos"

const ESTADO_VARIANT: Record<
  EstadoIngreso,
  "secondary" | "default" | "destructive"
> = {
  BORRADOR: "secondary",
  CONFIRMADO: "default",
  ANULADO: "destructive",
}

/** Con ceros a la izquierda, igual que en la nota impresa: 27/06/2026. */
function fecha(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—"
}

export function IngresosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "ingresosEscribir")
  // El almacén solo se muestra a quien ve más de uno: admin y super_admin ven
  // todos, y el observador los que tenga asignados para auditar. Al responsable
  // no le aporta, todas sus filas son del suyo. No va en PERMISOS porque ese
  // mapa espeja los @Roles del backend y esto es una decisión de presentación.
  const veVariosAlmacenes =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "observador_almacen"

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const [aEliminar, setAEliminar] = useState<IngresoListItem | null>(null)
  const busquedaDiferida = useDebouncedValue(busqueda)

  const eliminar = useEliminarIngreso()
  const { abrirNota, generandoId } = useNotaIngreso()

  const { data, isPending, isError, error } = useIngresos({
    page,
    pageSize,
    q: busquedaDiferida || undefined,
    estado: estado === "todos" ? undefined : estado,
  })

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  async function confirmarEliminacion() {
    if (!aEliminar) return
    try {
      await eliminar.mutateAsync(aEliminar.id)
    } catch {
      // toast en la mutación
    } finally {
      setAEliminar(null)
    }
  }

  const ingresos = data?.data ?? []
  // Nº · fecha · C31 · estado · [almacén] · proveedor · observación · acciones
  const columnas = veVariosAlmacenes ? 8 : 7

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Entradas de material al almacén. Un borrador se confirma para que
            impacte el stock.
          </p>
        </div>
        {puedeEscribir && (
          <Button onClick={() => navigate("/ingresos/nuevo")}>
            <Plus className="size-4" />
            Nuevo ingreso
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) =>
              cambiarFiltro(() => setBusqueda(e.target.value))
            }
            placeholder="Buscar por nota / C31 / factura..."
            className="pl-9"
            aria-label="Buscar ingresos"
          />
        </div>
        <Select
          value={estado}
          onValueChange={(v) =>
            cambiarFiltro(() => setEstado(v as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="BORRADOR">Borradores</SelectItem>
            <SelectItem value="CONFIRMADO">Confirmados</SelectItem>
            <SelectItem value="ANULADO">Anulados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha remisión</TableHead>
              <TableHead>Proceso Nº / C31</TableHead>
              {veVariosAlmacenes && <TableHead>Almacén</TableHead>}
              <TableHead>Proveedor</TableHead>
              <TableHead>Observación</TableHead>
              <TableHead>Estado</TableHead>
              {/* La columna va siempre: imprimir y ver los puede usar también
                  quien solo tiene lectura (observador de almacén). */}
              <TableHead className="text-right">Acciones</TableHead>
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
                  {getApiErrorMessage(error, "No se pudieron cargar los ingresos.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && ingresos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {estado !== "todos"
                    ? "Ningún ingreso con ese estado."
                    : "Todavía no hay ingresos registrados."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              ingresos.map((ingreso) => (
                <TableRow
                  key={ingreso.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/ingresos/${ingreso.id}`)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {etiquetaNumero(ingreso)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fecha(ingreso.fechaRemision)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ingreso.procesoC31 || "—"}
                  </TableCell>
                  {veVariosAlmacenes && (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {ingreso.almacen.nombre}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {ingreso.proveedor?.nombre ?? "—"}
                  </TableCell>
                  {/*
                    Completa, sin recortar: es el texto que dice de qué fue la
                    compra. Va en cuerpo más chico y parte en varias líneas.
                    `whitespace-normal` es obligatorio — `TableCell` trae
                    `whitespace-nowrap` de base y sin esto la fila salía en una
                    sola línea empujando la tabla fuera de la pantalla. El par
                    `w-full max-w-0` hace que esta columna absorba el ancho
                    sobrante y las demás se ajusten a su contenido.
                  */}
                  <TableCell className="w-full max-w-0 text-xs leading-snug whitespace-normal text-muted-foreground">
                    {ingreso.observacion || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[ingreso.estado]}>
                      {ESTADO_LABEL[ingreso.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconAction
                      icono={Eye}
                      etiqueta="Ver"
                      onClick={() => navigate(`/ingresos/${ingreso.id}`)}
                    />
                    <IconAction
                      // Imprime sin pasar por el detalle. La fila del listado no
                      // trae las líneas ni el proveedor completo, así que el hook
                      // pide el detalle antes de armar el PDF.
                      icono={generandoId === ingreso.id ? Loader2 : Printer}
                      cargando={generandoId === ingreso.id}
                      etiqueta="Imprimir"
                      onClick={() => abrirNota(ingreso.id)}
                      // Un borrador todavía no tiene número: no se imprime.
                      disabled={
                        ingreso.estado === "BORRADOR" || generandoId != null
                      }
                    />
                    {puedeEscribir && (
                      <IconAction
                        icono={Trash2}
                        etiqueta="Eliminar borrador"
                        onClick={() => setAEliminar(ingreso)}
                        // Solo se borra un borrador; los demás se anulan desde el detalle.
                        disabled={ingreso.estado !== "BORRADOR"}
                        destructiva
                      />
                    )}
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
          entidad="ingresos"
        />
      )}

      <AlertDialog
        open={aEliminar !== null}
        onOpenChange={(abierto) => !abierto && setAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra definitivamente (todavía no impactó el stock). Los
              ingresos confirmados no se borran: se anulan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                void confirmarEliminacion()
              }}
              disabled={eliminar.isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
