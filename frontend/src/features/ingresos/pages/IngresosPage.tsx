import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react"

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
import { DateRangeFilter } from "@/components/data/DateRangeFilter"
import { IconAction } from "@/components/data/IconAction"
import { MACIZO, TONO_ACCION } from "@/components/data/tonos-accion"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useIngresos } from "@/features/ingresos/hooks/useIngresos"
import { useNotaIngreso } from "@/features/ingresos/hooks/useNotaIngreso"
import { useReporteIngresos } from "@/features/ingresos/hooks/useReporteIngresos"
import {
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/ingresos/ingresos.types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { aIsoLocal } from "@/lib/fechas"
import { usePagination } from "@/hooks/use-pagination"

import type { DateRange } from "react-day-picker"
import type { FiltrosIngresos } from "@/features/ingresos/hooks/useReporteIngresos"
import type {
  EstadoIngreso,
  IngresoListItem,
} from "@/features/ingresos/ingresos.types"

type FiltroEstado = EstadoIngreso | "todos"

const TODOS = "todos"

/** Importe con separador de miles y dos decimales, como en el resto del sistema. */
const importe = (valor: string) =>
  Number(valor).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

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
  const [almacenId, setAlmacenId] = useState<string>(TODOS)
  const [rango, setRango] = useState<DateRange | undefined>()
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { abrirNota, generandoId } = useNotaIngreso()
  const {
    abrirReporte,
    generando: generandoReporte,
  } = useReporteIngresos()

  // Solo hace falta para el selector, así que se pide únicamente a quien lo ve.
  const { data: almacenes = [] } = useAlmacenesActivos({
    enabled: veVariosAlmacenes,
  })

  /**
   * Los filtros, en un solo objeto: el listado le agrega la paginación y el
   * reporte lo usa tal cual. Así el papel sale con lo mismo que está en
   * pantalla, sin poder desalinearse.
   */
  const filtros: FiltrosIngresos = {
    q: busquedaDiferida || undefined,
    estado: estado === "todos" ? undefined : estado,
    almacenId: almacenId === TODOS ? undefined : Number(almacenId),
    // En hora local: el rango se eligió en un calendario, y pasarlo por UTC
    // correría el día para quien está en un huso negativo (Bolivia, UTC-4).
    desde: rango?.from ? aIsoLocal(rango.from) : undefined,
    hasta: rango?.to ? aIsoLocal(rango.to) : undefined,
  }

  const { data, isPending, isError, error } = useIngresos({
    ...filtros,
    page,
    pageSize,
  })

  /** El almacén del encabezado del reporte: `null` = todos (nacional). */
  const almacenReporte =
    almacenId === TODOS
      ? null
      : (almacenes.find((a) => String(a.id) === almacenId)?.nombre ?? null)

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  const ingresos = data?.data ?? []
  // Nº · fecha ingreso · fecha remisión · C31 · [almacén] · observación ·
  // total · estado · acciones
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
        <div className="flex items-center gap-2">
          {/* Fuera del `puedeEscribir`: el reporte es lectura, así que también
              lo saca el observador de almacén. */}
          <Button
            variant="outline"
            onClick={() => abrirReporte(filtros, almacenReporte)}
            disabled={generandoReporte}
          >
            {generandoReporte ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Reporte
          </Button>
          {puedeEscribir && (
            <Button onClick={() => navigate("/ingresos/nuevo")}>
              <Plus className="size-4" />
              Nuevo ingreso
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) =>
              cambiarFiltro(() => setBusqueda(e.target.value))
            }
            placeholder="Buscar por C31 / certificación / observación..."
            className="pl-9"
            aria-label="Buscar ingresos"
          />
        </div>

        {/* El rango es sobre la FECHA DE INGRESO (la de efecto contable), no
            sobre la de remisión: así lo filtrado coincide con lo que movió el
            Kardex, y es lo que se lleva el reporte. */}
        <DateRangeFilter
          value={rango}
          onChange={(nuevo) => cambiarFiltro(() => setRango(nuevo))}
          className="sm:w-60"
          aria-label="Filtrar por fecha de ingreso"
        />
        {/* Solo para quien ve más de un almacén; al responsable no le aporta
            (todas sus filas son del suyo). El backend cruza igual lo que se
            pida contra el scope del rol: el filtro afina, no amplía. */}
        {veVariosAlmacenes && (
          <Select
            value={almacenId}
            onValueChange={(v) => cambiarFiltro(() => setAlmacenId(v))}
          >
            <SelectTrigger className="sm:w-56" aria-label="Filtrar por almacén">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={TODOS}>Todos los almacenes</SelectItem>
              {almacenes.map((almacen) => (
                <SelectItem key={almacen.id} value={String(almacen.id)}>
                  {almacen.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={estado}
          onValueChange={(v) =>
            cambiarFiltro(() => setEstado(v as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="CONFIRMADO">Confirmados</SelectItem>
            <SelectItem value="ANULADO">Anulados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
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
              <TableHead>Observación</TableHead>
              {/* Lo que costó el ingreso: es el dato que más se busca de una
                  fila y no estaba en ninguna parte del listado. A la derecha y
                  con cifras de ancho fijo para poder compararlas de un vistazo
                  entre filas. */}
              <TableHead className="text-right">Total (Bs)</TableHead>
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
                  {estado !== "todos" ||
                  almacenId !== TODOS ||
                  busquedaDiferida
                    ? "Ningún ingreso con esos filtros."
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
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                    {importe(ingreso.total)}
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

      

      {/* Visor propio: nunca están abiertos los dos a la vez, pero cada hook
          maneja su object URL y lo revoca al cerrarse. */}
      
    </div>
  )
}
