import { useState } from "react"
import { ImageOff, Pencil, Plus, PowerOff, Search } from "lucide-react"

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
import { ItemFormDialog } from "@/features/items/ItemFormDialog"
import { useDesactivarItem, useItems } from "@/features/items/useItems"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"
import { urlArchivo } from "@/lib/files"

import type { Item } from "@/features/items/items.types"

type FiltroEstado = "todos" | "activos" | "inactivos"

export function ItemsPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "itemsEscribir")

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [itemEnEdicion, setItemEnEdicion] = useState<Item | null>(null)
  const [itemADesactivar, setItemADesactivar] = useState<Item | null>(null)

  const desactivar = useDesactivarItem()

  const { data, isPending, isError, error } = useItems({
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
    setItemEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(item: Item) {
    setItemEnEdicion(item)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!itemADesactivar) return
    try {
      await desactivar.mutateAsync(itemADesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setItemADesactivar(null)
    }
  }

  const items = data?.data ?? []
  const columnas = puedeEscribir ? 6 : 5

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ítems</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo compartido por todos los almacenes.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nuevo ítem
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
            placeholder="Buscar por código o descripción..."
            className="pl-9"
            aria-label="Buscar ítems"
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
              <TableHead className="w-16">Imagen</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Unidad</TableHead>
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
                  {getApiErrorMessage(error, "No se pudieron cargar los ítems.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos"
                    ? "Ningún ítem coincide con la búsqueda."
                    : "Todavía no hay ítems en el catálogo."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              items.map((item) => {
                const src = urlArchivo(item.imagenUrl)
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex size-10 items-center justify-center overflow-hidden rounded border bg-muted">
                        {src ? (
                          <img
                            src={src}
                            alt={item.descripcion}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageOff className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-sm">{item.codigo}</code>
                      <p className="text-xs text-muted-foreground">
                        {item.partida.denominacion}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.descripcion}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.unidadMedida}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.activo ? "default" : "destructive"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {puedeEscribir && (
                      <TableCell className="text-right">
                        <IconAction
                          icono={Pencil}
                          etiqueta="Editar"
                          onClick={() => abrirEdicion(item)}
                        />
                        <IconAction
                          icono={PowerOff}
                          etiqueta="Desactivar"
                          onClick={() => setItemADesactivar(item)}
                          disabled={!item.activo}
                          destructiva
                        />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          meta={data.meta}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entidad="ítems"
        />
      )}

      <ItemFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        item={itemEnEdicion}
        // Si el ítem se creó pero su imagen falló, el diálogo pasa a editarlo
        // para que el reintento no obligue a rehacer el formulario.
        onCreado={setItemEnEdicion}
      />

      <AlertDialog
        open={itemADesactivar !== null}
        onOpenChange={(abierto) => !abierto && setItemADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar el ítem {itemADesactivar?.codigo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{itemADesactivar?.descripcion}» dejará de estar disponible para
              nuevos movimientos. El ítem no se elimina y su stock e historial se
              conservan. Podés volver a activarlo editándolo.
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
