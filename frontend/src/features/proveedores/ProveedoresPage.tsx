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
import { ProveedorFormDialog } from "@/features/proveedores/ProveedorFormDialog"
import {
  useDesactivarProveedor,
  useProveedores,
} from "@/features/proveedores/useProveedores"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type { Proveedor } from "@/features/proveedores/proveedores.types"

type FiltroEstado = "todos" | "activos" | "inactivos"

export function ProveedoresPage() {
  const { user } = useAuth()
  // `responsable_almacen` entra solo a leer: necesita el listado para elegir
  // proveedor al registrar un ingreso, pero no puede crearlos ni editarlos.
  const puedeEscribir = tienePermiso(user, "proveedoresEscribir")

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Proveedor | null>(null)
  const [aDesactivar, setADesactivar] = useState<Proveedor | null>(null)

  const desactivar = useDesactivarProveedor()

  const { data, isPending, isError, error } = useProveedores({
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

  function abrirEdicion(proveedor: Proveedor) {
    setEnEdicion(proveedor)
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

  const proveedores = data?.data ?? []
  const columnas = puedeEscribir ? 6 : 5

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Quiénes abastecen a los almacenes. Se usan al registrar ingresos.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nuevo proveedor
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
            placeholder="Buscar por nombre, NIT o contacto..."
            className="pl-9"
            aria-label="Buscar proveedores"
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
              <TableHead>NIT</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead>
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
                    "No se pudieron cargar los proveedores."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && proveedores.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos"
                    ? "Ningún proveedor coincide con la búsqueda."
                    : "Todavía no hay proveedores registrados."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              proveedores.map((proveedor) => (
                <TableRow key={proveedor.id}>
                  <TableCell className="font-medium">
                    {proveedor.nombre}
                  </TableCell>
                  {/* Los opcionales pueden venir null: se muestra un guion. */}
                  <TableCell className="text-muted-foreground">
                    {proveedor.nit ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {proveedor.contacto ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {proveedor.telefono ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={proveedor.activo ? "default" : "destructive"}
                    >
                      {proveedor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEscribir && (
                    <TableCell className="text-right">
                      <IconAction
                        icono={Pencil}
                        etiqueta="Editar"
                        onClick={() => abrirEdicion(proveedor)}
                      />
                      <IconAction
                        icono={PowerOff}
                        etiqueta="Desactivar"
                        onClick={() => setADesactivar(proveedor)}
                        disabled={!proveedor.activo}
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
          entidad="proveedores"
        />
      )}

      <ProveedorFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        proveedor={enEdicion}
      />

      <AlertDialog
        open={aDesactivar !== null}
        onOpenChange={(abierto) => !abierto && setADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar a «{aDesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de aparecer al registrar nuevos ingresos. El proveedor no se
              elimina nunca: los ingresos que ya lo referencian conservan su
              historial en el Kardex. Podés volver a activarlo editándolo.
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
