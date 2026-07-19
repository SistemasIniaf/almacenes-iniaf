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
import { ROLES, ROL_LABEL } from "@/features/auth/lib/auth.types"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { UsuarioFormDialog } from "@/features/usuarios/UsuarioFormDialog"
import {
  useDesactivarUsuario,
  useUsuarios,
} from "@/features/usuarios/useUsuarios"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { PAGE_SIZE } from "@/lib/types"

import type { Rol } from "@/features/auth/lib/auth.types"
import type { Usuario } from "@/features/usuarios/usuarios.types"

type FiltroEstado = "todos" | "activos" | "inactivos"
/** "todos" no es un Rol valido: se usa solo como marca de "sin filtro". */
type FiltroRol = Rol | "todos"

/** Ambito del usuario segun su rol: unidad, almacen, almacenes observados o nada. */
function describirAmbito(usuario: Usuario): string {
  if (usuario.unidad && usuario.almacen) {
    return `${usuario.unidad.sigla} · ${usuario.almacen.nombre}`
  }
  if (usuario.unidad) return usuario.unidad.sigla
  if (usuario.almacen) return usuario.almacen.nombre
  if (usuario.almacenesObservados.length > 0) {
    return usuario.almacenesObservados
      .map((observado) => observado.almacen.nombre)
      .join(", ")
  }
  return "—"
}

export function UsuariosPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "usuariosEscribir")

  const [page, setPage] = useState(1)
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("todos")
  const [rol, setRol] = useState<FiltroRol>("todos")
  const busquedaDiferida = useDebouncedValue(busqueda)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<Usuario | null>(null)
  const [usuarioADesactivar, setUsuarioADesactivar] = useState<Usuario | null>(
    null
  )

  const desactivar = useDesactivarUsuario()

  const { data, isPending, isError, error } = useUsuarios({
    page,
    pageSize: PAGE_SIZE,
    q: busquedaDiferida || undefined,
    activo: estado === "todos" ? undefined : estado === "activos",
    rol: rol === "todos" ? undefined : rol,
  })

  function cambiarFiltro(accion: () => void) {
    accion()
    setPage(1)
  }

  function abrirCreacion() {
    setUsuarioEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(usuario: Usuario) {
    setUsuarioEnEdicion(usuario)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!usuarioADesactivar) return
    try {
      await desactivar.mutateAsync(usuarioADesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setUsuarioADesactivar(null)
    }
  }

  const usuarios = data?.data ?? []
  const columnas = puedeEscribir ? 6 : 5

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas del sistema y su rol dentro del circuito de aprobación.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nuevo usuario
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
            placeholder="Buscar por nombre o usuario..."
            className="pl-9"
            aria-label="Buscar usuarios"
          />
        </div>

        <Select
          value={rol}
          onValueChange={(valor) =>
            cambiarFiltro(() => setRol(valor as FiltroRol))
          }
        >
          <SelectTrigger className="sm:w-56" aria-label="Filtrar por rol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {ROLES.map((valor) => (
              <SelectItem key={valor} value={valor}>
                {ROL_LABEL[valor]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={estado}
          onValueChange={(valor) =>
            cambiarFiltro(() => setEstado(valor as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-40" aria-label="Filtrar por estado">
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
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Unidad / Almacén</TableHead>
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
                    "No se pudieron cargar los usuarios."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && usuarios.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {busquedaDiferida || estado !== "todos" || rol !== "todos"
                    ? "Ningún usuario coincide con los filtros."
                    : "Todavía no hay usuarios registrados."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">
                    {usuario.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {usuario.usuario}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROL_LABEL[usuario.rol]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {describirAmbito(usuario)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? "default" : "destructive"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEscribir && (
                    <TableCell className="text-right">
                      <IconAction
                        icono={Pencil}
                        etiqueta="Editar"
                        onClick={() => abrirEdicion(usuario)}
                      />
                      <IconAction
                        icono={PowerOff}
                        etiqueta="Desactivar"
                        onClick={() => setUsuarioADesactivar(usuario)}
                        // Nadie puede desactivarse a si mismo: se quedaria sin
                        // sesion en el proximo refresh y sin poder revertirlo.
                        disabled={!usuario.activo || usuario.id === user?.id}
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
          entidad="usuarios"
        />
      )}

      <UsuarioFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        usuario={usuarioEnEdicion}
      />

      <AlertDialog
        open={usuarioADesactivar !== null}
        onOpenChange={(abierto) => !abierto && setUsuarioADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar a «{usuarioADesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              No podrá iniciar sesión. La cuenta no se elimina y su historial de
              aprobaciones se conserva. Si tenía un rol único (aprobador,
              responsable o central), su cupo queda libre para otra persona.
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
