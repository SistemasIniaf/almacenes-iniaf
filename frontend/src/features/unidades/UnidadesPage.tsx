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
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { UnidadFormDialog } from "@/features/unidades/UnidadFormDialog"
import {
  useDesactivarUnidad,
  useUnidades,
} from "@/features/unidades/useUnidades"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type { Unidad } from "@/features/unidades/unidades.types"

/** Valor del filtro de estado; "todos" significa no mandar el parametro. */
type FiltroEstado = "todos" | "activas" | "inactivas"

export function UnidadesPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "unidadesEscribir")

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [unidadEnEdicion, setUnidadEnEdicion] = useState<Unidad | null>(null)
  const [unidadADesactivar, setUnidadADesactivar] = useState<Unidad | null>(null)

  const desactivar = useDesactivarUnidad()

  const { data, isPending, isError, error } = useUnidades({
    page,
    pageSize,
    q: busquedaDiferida || undefined,
    activo: estado === "todos" ? undefined : estado === "activas",
  })

  /** Cualquier cambio de filtro invalida la pagina actual: hay que volver a la 1. */
  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  function abrirCreacion() {
    setUnidadEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(unidad: Unidad) {
    setUnidadEnEdicion(unidad)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!unidadADesactivar) return
    try {
      await desactivar.mutateAsync(unidadADesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setUnidadADesactivar(null)
    }
  }

  const unidades = data?.data ?? []
  const columnas = puedeEscribir ? 4 : 3

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Áreas administrativas de la institución.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nueva unidad
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
            placeholder="Buscar por nombre o sigla..."
            className="pl-9"
            aria-label="Buscar unidades"
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
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="activas">Solo activas</SelectItem>
            <SelectItem value="inactivas">Solo inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Sigla</TableHead>
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
                  {getApiErrorMessage(error, "No se pudieron cargar las unidades.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && unidades.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos"
                    ? "Ninguna unidad coincide con la búsqueda."
                    : "Todavía no hay unidades registradas."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              unidades.map((unidad) => (
                <TableRow key={unidad.id}>
                  <TableCell className="font-medium">{unidad.nombre}</TableCell>
                  <TableCell>{unidad.sigla}</TableCell>
                  <TableCell>
                    <Badge variant={unidad.activo ? "default" : "destructive"}>
                      {unidad.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  {puedeEscribir && (
                    <TableCell className="text-right">
                      <IconAction
                        icono={Pencil}
                        etiqueta="Editar"
                        onClick={() => abrirEdicion(unidad)}
                      />
                      <IconAction
                        icono={PowerOff}
                        etiqueta="Desactivar"
                        onClick={() => setUnidadADesactivar(unidad)}
                        disabled={!unidad.activo}
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
          onPageSizeChange={setPageSize}
          entidad="unidades"
        />
      )}

      <UnidadFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        unidad={unidadEnEdicion}
      />

      <AlertDialog
        open={unidadADesactivar !== null}
        onOpenChange={(abierto) => !abierto && setUnidadADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar «{unidadADesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La unidad no se elimina: queda inactiva y deja de poder asignarse a
              usuarios. Podés volver a activarla editándola.
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
