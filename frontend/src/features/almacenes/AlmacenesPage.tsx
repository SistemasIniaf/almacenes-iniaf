import { useState } from "react"
import { Pencil, Plus, PowerOff, Search } from "lucide-react"

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
import { AlmacenFormDialog } from "@/features/almacenes/AlmacenFormDialog"
import {
  useAlmacenes,
  useDesactivarAlmacen,
} from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { PAGE_SIZE } from "@/lib/types"

import type { Almacen } from "@/features/almacenes/almacenes.types"

/** Valor del filtro de estado; "todos" significa no mandar el parametro. */
type FiltroEstado = "todos" | "activos" | "inactivos"

export function AlmacenesPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "almacenesEscribir")

  const [page, setPage] = useState(1)
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [almacenEnEdicion, setAlmacenEnEdicion] = useState<Almacen | null>(null)
  const [almacenADesactivar, setAlmacenADesactivar] = useState<Almacen | null>(
    null
  )

  const desactivar = useDesactivarAlmacen()

  const { data, isPending, isError, error } = useAlmacenes({
    page,
    pageSize: PAGE_SIZE,
    q: busquedaDiferida || undefined,
    activo: estado === "todos" ? undefined : estado === "activos",
  })

  /** Cualquier cambio de filtro invalida la pagina actual: hay que volver a la 1. */
  function cambiarFiltro(accion: () => void) {
    accion()
    setPage(1)
  }

  function abrirCreacion() {
    setAlmacenEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(almacen: Almacen) {
    setAlmacenEnEdicion(almacen)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!almacenADesactivar) return
    try {
      await desactivar.mutateAsync(almacenADesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setAlmacenADesactivar(null)
    }
  }

  const almacenes = data?.data ?? []
  const columnas = puedeEscribir ? 3 : 2

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Almacenes</h1>
          <p className="text-sm text-muted-foreground">
            Cada almacén maneja su propio stock y correlativos.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nuevo almacén
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
            placeholder="Buscar por nombre..."
            className="pl-9"
            aria-label="Buscar almacenes"
          />
        </div>

        <Select
          value={estado}
          onValueChange={(valor) =>
            cambiarFiltro(() => setEstado(valor as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Solo activos</SelectItem>
            <SelectItem value="inactivos">Solo inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEscribir && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
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
                  {getApiErrorMessage(
                    error,
                    "No se pudieron cargar los almacenes."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && almacenes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos"
                    ? "Ningún almacén coincide con la búsqueda."
                    : "Todavía no hay almacenes registrados."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              almacenes.map((almacen) => (
                <TableRow key={almacen.id}>
                  <TableCell className="font-medium">
                    {almacen.nombre}
                  </TableCell>
                  <TableCell>
                    <Badge variant={almacen.activo ? "default" : "destructive"}>
                      {almacen.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEscribir && (
                    <TableCell className="text-right">
                      <IconAction
                        icono={Pencil}
                        etiqueta="Editar"
                        onClick={() => abrirEdicion(almacen)}
                      />
                      <IconAction
                        icono={PowerOff}
                        etiqueta="Desactivar"
                        onClick={() => setAlmacenADesactivar(almacen)}
                        disabled={!almacen.activo}
                        destructiva
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          meta={data.meta}
          onPageChange={setPage}
          entidad="almacenes"
        />
      )}

      <AlmacenFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        almacen={almacenEnEdicion}
      />

      <AlertDialog
        open={almacenADesactivar !== null}
        onOpenChange={(abierto) => !abierto && setAlmacenADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar «{almacenADesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El almacén no se elimina: queda inactivo y deja de poder asignarse
              a usuarios. Su stock y su historial se conservan. Podés volver a
              activarlo editándolo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desactivar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                // Sin esto el dialogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarDesactivacion()
              }}
              disabled={desactivar.isPending}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
