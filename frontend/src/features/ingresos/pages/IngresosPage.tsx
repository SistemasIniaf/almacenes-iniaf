import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, FileText, Loader2, Pencil, Plus, Search } from "lucide-react"

import { BadgeEstado } from "@/components/data/BadgeEstado"
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
import { MACIZO, TONO_ACCION } from "@/components/data/tonos-accion"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useIngresos } from "@/features/ingresos/hooks/useIngresos"
import { useNotaIngreso } from "@/features/ingresos/hooks/useNotaIngreso"
import { PdfDialog } from "@/components/pdf/PdfDialog"
import {
  ESTADO_LABEL,
  ESTADO_PUNTO,
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
  /** Un ingreso se edita si el rol escribe y el registro sigue vigente. */
  const puedeEditar = (ingreso: IngresoListItem) =>
    puedeEscribir && ingreso.estado !== "ANULADO"
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
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { abrirNota, generandoId, pdf, cerrarPdf } = useNotaIngreso()

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

  const ingresos = data?.data ?? []
  // Nº · fecha · C31 · estado · [almacén] · proveedor · observación · acciones
  const columnas = veVariosAlmacenes ? 9 : 8

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Entradas de material al almacén. Al registrarse impactan el stock;
            para corregir un error se anula el ingreso.
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
            <SelectItem value="CONFIRMADO">Confirmados</SelectItem>
            <SelectItem value="ANULADO">Anulados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              {/* Las dos fechas, una al lado de la otra. La de ingreso va
                  primero y pegada al número porque es de la que sale su
                  gestión; la de remisión es la del documento del proveedor y
                  no gobierna nada (ver docs/decisiones-ingresos.md punto 7). */}
              <TableHead>Fecha ingreso</TableHead>
              <TableHead>Fecha remisión</TableHead>
              {/* En dos renglones: el rótulo es más largo que su contenido (un
                  número) y arrastraba el ancho de toda la columna. El `<br>`
                  corta igual con el `whitespace-nowrap` del TableHead, y las
                  dos líneas entran en el alto que ya tiene (h-10). */}
              {/* Abreviado: el rótulo completo («Proceso Nº / C31») es más
                  largo que su contenido —un número— y arrastraba el ancho de
                  toda la columna. Entero se lee en el formulario y en el PDF. */}
              <TableHead>Proc. C31</TableHead>
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
                  <TableCell className="whitespace-nowrap">
                    {fecha(ingreso.fechaIngreso)}
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
                    <BadgeEstado tono={ESTADO_PUNTO[ingreso.estado]}>
                      {ESTADO_LABEL[ingreso.estado]}
                    </BadgeEstado>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/*
                      Lápiz u ojo según lo que la fila realmente permita: un
                      ingreso vigente se edita (la cabecera documental; las
                      líneas y el stock quedan fijos desde que se registra),
                      pero uno ANULADO ya no, y quien solo tiene lectura
                      tampoco. Un lápiz fijo prometería algo que no se cumple.
                    */}
                    <IconAction
                      icono={puedeEditar(ingreso) ? Pencil : Eye}
                      etiqueta={puedeEditar(ingreso) ? "Editar" : "Ver"}
                      onClick={() => navigate(`/ingresos/${ingreso.id}`)}
                      // El color acompaña al verbo, no al botón: ámbar cuando de
                      // verdad se edita, turquesa cuando solo se consulta.
                      className={
                        puedeEditar(ingreso)
                          ? TONO_ACCION.editar
                          : TONO_ACCION.ver
                      }
                    />
                    <IconAction
                      // Imprime sin pasar por el detalle. La fila del listado no
                      // trae las líneas ni el proveedor completo, así que el hook
                      // pide el detalle antes de armar el PDF.
                      icono={generandoId === ingreso.id ? Loader2 : FileText}
                      cargando={generandoId === ingreso.id}
                      etiqueta="Ver la nota en PDF"
                      onClick={() => abrirNota(ingreso.id)}
                      disabled={generandoId != null}
                      className={TONO_ACCION.pdf}
                      // Macizo (relleno del color del texto, trazo del color del
                      // fondo) y un punto más grande que el resto: es la acción
                      // que más se busca en la fila.
                      //
                      // El `size-5` va SIEMPRE, también con el spinner: si el
                      // tamaño cambiara al empezar a generar, la fila daría un
                      // salto. Lo único que se saca es el relleno — un `Loader2`
                      // macizo sería una mancha girando.
                      iconoClassName={
                        generandoId === ingreso.id
                          ? "size-5"
                          : `size-5 ${MACIZO}`
                      }
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
          entidad="ingresos"
        />
      )}

      {pdf && (
        <PdfDialog titulo="Nota de ingreso" {...pdf} onClose={cerrarPdf} />
      )}
    </div>
  )
}
