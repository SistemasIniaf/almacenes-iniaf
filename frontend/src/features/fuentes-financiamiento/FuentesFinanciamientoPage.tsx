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
import { FuenteFinanciamientoFormDialog } from "@/features/fuentes-financiamiento/FuenteFinanciamientoFormDialog"
import {
  useDesactivarFuente,
  useFuentes,
} from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type { FuenteFinanciamiento } from "@/features/fuentes-financiamiento/fuentes-financiamiento.types"

type FiltroEstado = "todos" | "activos" | "inactivos"

export function FuentesFinanciamientoPage() {
  const { user } = useAuth()
  // `responsable_almacen` entra solo a leer: necesita el listado para elegir la
  // fuente en la cabecera del ingreso, pero no puede crearlas ni editarlas.
  const puedeEscribir = tienePermiso(user, "fuentesEscribir")

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<FuenteFinanciamiento | null>(null)
  const [aDesactivar, setADesactivar] =
    useState<FuenteFinanciamiento | null>(null)

  const desactivar = useDesactivarFuente()

  const { data, isPending, isError, error } = useFuentes({
    page,
    pageSize,
    q: busquedaDiferida || undefined,
    activo: estado === "todos" ? undefined : estado === "activos",
  })

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  function abrirCreacion() {
    setEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(fuente: FuenteFinanciamiento) {
    setEnEdicion(fuente)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!aDesactivar) return
    try {
      await desactivar.mutateAsync(aDesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setADesactivar(null)
    }
  }

  const fuentes = data?.data ?? []
  const columnas = puedeEscribir ? 4 : 3

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fuentes de financiamiento
          </h1>
          <p className="text-sm text-muted-foreground">
            El origen de los recursos con que se compra. El stock se separa por
            fuente: cada financiador rinde cuentas de su plata.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nueva fuente
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
            placeholder="Buscar por nombre o código..."
            className="pl-9"
            aria-label="Buscar fuentes de financiamiento"
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
            <SelectItem value="activos">Solo activas</SelectItem>
            <SelectItem value="inactivos">Solo inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código</TableHead>
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
                    "No se pudieron cargar las fuentes de financiamiento."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && fuentes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos"
                    ? "Ninguna fuente coincide con la búsqueda."
                    : "Todavía no hay fuentes de financiamiento registradas."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              fuentes.map((fuente) => (
                <TableRow key={fuente.id}>
                  <TableCell className="font-medium">{fuente.nombre}</TableCell>
                  {/* El codigo es opcional: puede venir null. */}
                  <TableCell className="text-muted-foreground">
                    {fuente.codigo ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={fuente.activo ? "default" : "destructive"}>
                      {fuente.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  {puedeEscribir && (
                    <TableCell className="text-right">
                      <IconAction
                        icono={Pencil}
                        etiqueta="Editar"
                        onClick={() => abrirEdicion(fuente)}
                      />
                      <IconAction
                        icono={PowerOff}
                        etiqueta="Desactivar"
                        onClick={() => setADesactivar(fuente)}
                        disabled={!fuente.activo}
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
          entidad="fuentes"
        />
      )}

      <FuenteFinanciamientoFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        fuente={enEdicion}
      />

      <AlertDialog
        open={aDesactivar !== null}
        onOpenChange={(abierto) => !abierto && setADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar «{aDesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de aparecer al registrar nuevos ingresos. La fuente no se
              elimina nunca: los lotes que ya la referencian conservan su
              historial en el Kardex. Podés volver a activarla editándola.
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
