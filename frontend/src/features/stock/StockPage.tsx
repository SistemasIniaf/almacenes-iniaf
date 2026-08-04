import { Fragment, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Printer,
  Search,
} from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataPagination } from "@/components/data/DataPagination"
import { IconAction } from "@/components/data/IconAction"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useFuentesActivas } from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"
import {
  usePartidasConStock,
  useReporteStock,
  useStock,
} from "@/features/stock/useStock"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePagination } from "@/hooks/use-pagination"
import { getApiErrorMessage } from "@/lib/api"
import { cantidad, moneda, precio } from "@/lib/formato"

import type { TipoReporteStock } from "@/features/stock/useStock"
import type { ItemStock, LoteStock } from "@/features/stock/stock.types"

const TODOS = "todos"

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—"

/** `001/2026`, igual que en la nota de ingreso. */
const etiquetaIngreso = (lote: LoteStock) =>
  lote.ingreso.numero != null && lote.ingreso.gestion != null
    ? `${String(lote.ingreso.numero).padStart(3, "0")}/${lote.ingreso.gestion}`
    : "—"

const valorLote = (lote: LoteStock) =>
  Number(lote.saldoCantidad) * Number(lote.precioUnitario)

const valorItem = (item: ItemStock) =>
  item.lotes.reduce((total, lote) => total + valorLote(lote), 0)

export function StockPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Igual que en el listado de ingresos: el almacén solo se elige si el usuario
  // ve más de uno. El responsable tiene el suyo y no puede cambiarlo.
  const veVariosAlmacenes =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "observador_almacen"

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [almacenId, setAlmacenId] = useState<string>(TODOS)
  const [fuenteId, setFuenteId] = useState<string>(TODOS)
  const [partidaId, setPartidaId] = useState<string>(TODOS)
  const [expandidos, setExpandidos] = useState<Set<number>>(() => new Set())
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { data: almacenes = [] } = useAlmacenesActivos()
  const { data: fuentes = [] } = useFuentesActivas()

  const filtrosComunes = {
    q: busquedaDiferida || undefined,
    almacenId: almacenId === TODOS ? undefined : Number(almacenId),
    fuenteFinanciamientoId: fuenteId === TODOS ? undefined : Number(fuenteId),
  }

  const { data, isPending, isError, error } = useStock({
    page,
    pageSize,
    ...filtrosComunes,
    partidaId: partidaId === TODOS ? undefined : Number(partidaId),
  })
  // El selector se arma con lo que hay en stock bajo los OTROS filtros, así no
  // ofrece partidas que darían una tabla vacía.
  const { data: partidas = [] } = usePartidasConStock(filtrosComunes)
  const { abrirReporte, generando: generandoReporte } = useReporteStock()

  /** Emite un reporte con los filtros que estén puestos en la pantalla. */
  function imprimir(tipo: TipoReporteStock) {
    void abrirReporte(
      tipo,
      {
        ...filtrosComunes,
        partidaId: partidaId === TODOS ? undefined : Number(partidaId),
      },
      // null = todos: el reporte se titula NACIONAL y omite la oficina,
      // igual que la entrada aparte que tiene el sistema anterior.
      almacenId === TODOS
        ? null
        : (almacenes.find((a) => String(a.id) === almacenId)?.nombre ?? "—")
    )
  }

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  function alternar(itemId: number) {
    setExpandidos((previos) => {
      const proximos = new Set(previos)
      if (proximos.has(itemId)) proximos.delete(itemId)
      else proximos.add(itemId)
      return proximos
    })
  }

  const items = data?.data ?? []
  // desplegar · código · ítem · unidad · saldo · valorizado · kardex
  const columnas = 7

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Existencias por ítem. El saldo no es un número suelto: sale de los
            lotes que trajo cada ingreso, cada uno con su precio y su fuente de
            financiamiento. Desplegá un ítem para verlos.
          </p>
        </div>
        {/* Los dos reportes del sistema anterior. Ambos respetan los filtros
            que estén puestos en la pantalla. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={generandoReporte}
            >
              {generandoReporte ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Reportes
              <ChevronDown className="size-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {/* Los dos nombres los fijó la institución: dicen por qué eje
                agrupa cada uno, que es lo único que los diferencia. */}
            <DropdownMenuItem onClick={() => imprimir("detalle")}>
              <div>
                <div className="font-medium">
                  Estado de almacenes consolidado por ítem
                </div>
                <div className="text-xs text-muted-foreground">
                  Detalle de cada ítem, con su fuente, agrupado por partida.
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => imprimir("consolidado")}>
              <div>
                <div className="font-medium">
                  Estado de almacenes consolidado por partida
                </div>
                <div className="text-xs text-muted-foreground">
                  Resumen valorizado por partida y fuente, sin ítems.
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))}
            placeholder="Buscar por código o descripción..."
            className="pl-9"
            aria-label="Buscar ítems"
          />
        </div>

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
          value={fuenteId}
          onValueChange={(v) => cambiarFiltro(() => setFuenteId(v))}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filtrar por fuente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={TODOS}>Todas las fuentes</SelectItem>
            {fuentes.map((fuente) => (
              <SelectItem key={fuente.id} value={String(fuente.id)}>
                {fuente.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={partidaId}
          onValueChange={(v) => cambiarFiltro(() => setPartidaId(v))}
        >
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por partida">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={TODOS}>Todas las partidas</SelectItem>
            {partidas.map((partida) => (
              <SelectItem key={partida.id} value={String(partida.id)}>
                {partida.codigo} · {partida.denominacion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Código</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Valorizado (Bs)</TableHead>
              <TableHead className="w-12" />
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
                  {getApiErrorMessage(error, "No se pudo cargar el stock.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Ningún ítem con existencias para ese filtro.
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              items.map((item, indice) => {
                const abierto = expandidos.has(item.id)
                // Encabezado de grupo cuando cambia la partida. El backend
                // ordena por código de partida, así que los ítems de una misma
                // ya vienen juntos; en el primero de la página siempre se
                // dibuja, para que un grupo partido entre páginas no quede sin
                // título. Es como agrupa el reporte oficial.
                const partidaNueva =
                  items[indice - 1]?.partida.id !== item.partida.id
                return (
                  // El key va en el Fragment: es lo que devuelve el map. Un <>
                  // no admite key y las de adentro no cuentan.
                  <Fragment key={item.id}>
                    {partidaNueva && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={columnas}
                          className="bg-muted/60 py-1.5 text-xs font-semibold"
                        >
                          <span className="tabular-nums">
                            {item.partida.codigo}
                          </span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="font-medium">
                            {item.partida.denominacion}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => alternar(item.id)}
                    >
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={
                            abierto ? "Ocultar lotes" : "Ver lotes"
                          }
                          aria-expanded={abierto}
                          onClick={(e) => {
                            e.stopPropagation()
                            alternar(item.id)
                          }}
                        >
                          {abierto ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {item.codigo}
                      </TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {cantidad(item.saldoTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {moneda(valorItem(item))}
                      </TableCell>
                      {/* Atajo al kardex del ítem: es la pregunta que sigue
                          naturalmente a "¿cuánto hay?" — "¿y cómo llegó a eso?".
                          Lleva el almacén si hay uno filtrado; si no, el kardex
                          lo pide (su saldo es por almacén). */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconAction
                          icono={BookOpen}
                          etiqueta="Ver kardex"
                          onClick={() =>
                            navigate(
                              `/kardex?item=${item.id}` +
                                (almacenId === TODOS ? "" : `&almacen=${almacenId}`)
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>

                    {abierto && (
                      <TableRow className="hover:bg-transparent">
                        {/* Los lotes van en una fila propia que ocupa todo el
                            ancho: una sub-tabla dentro de la celda mantiene sus
                            columnas alineadas entre sí sin pelearse con las de
                            la tabla de arriba. */}
                        <TableCell colSpan={columnas} className="bg-muted/40 p-0">
                          <div className="px-10 py-3">
                            <div className="mb-2 text-xs font-medium">
                              {item.lotes.length} lote
                              {item.lotes.length === 1 ? "" : "s"} con saldo
                            </div>
                            <Table>
                              {/* Sin el fondo que `TableHeader` trae por
                                  defecto: esta sub-tabla ya está dentro de la
                                  fila expandida, que se pinta con `bg-muted/50`,
                                  y dos superficies encima se enturbian. */}
                              <TableHeader className="bg-transparent">
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="h-8 text-xs">
                                    Ingreso
                                  </TableHead>
                                  {/* La del ingreso: es la que ordena los lotes
                                      (más antiguo primero, el orden en que se
                                      van a consumir). */}
                                  <TableHead className="h-8 text-xs">
                                    Fecha
                                  </TableHead>
                                  <TableHead className="h-8 text-xs">
                                    Fuente
                                  </TableHead>
                                  {veVariosAlmacenes && (
                                    <TableHead className="h-8 text-xs">
                                      Almacén
                                    </TableHead>
                                  )}
                                  <TableHead className="h-8 text-xs">
                                    Proveedor
                                  </TableHead>
                                  <TableHead className="h-8 text-right text-xs">
                                    P. unitario
                                  </TableHead>
                                  <TableHead className="h-8 text-right text-xs">
                                    Saldo
                                  </TableHead>
                                  <TableHead className="h-8 text-right text-xs">
                                    Valor (Bs)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {item.lotes.map((lote) => (
                                  <TableRow
                                    key={lote.id}
                                    className="hover:bg-transparent"
                                  >
                                    <TableCell className="py-1.5 text-xs font-medium whitespace-nowrap">
                                      {etiquetaIngreso(lote)}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs whitespace-nowrap text-muted-foreground">
                                      {fecha(lote.ingreso.fechaIngreso)}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs">
                                      <Badge
                                        variant="secondary"
                                        className="font-normal"
                                      >
                                        {lote.ingreso.fuenteFinanciamiento
                                          ?.nombre ?? "—"}
                                      </Badge>
                                    </TableCell>
                                    {veVariosAlmacenes && (
                                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                                        {lote.ingreso.almacen.nombre}
                                      </TableCell>
                                    )}
                                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                                      {lote.ingreso.proveedor?.nombre ?? "—"}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                      {precio(lote.precioUnitario)}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                      {cantidad(lote.saldoCantidad)} de{" "}
                                      {cantidad(lote.cantidad)}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                      {moneda(valorLote(lote))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
    </div>
  )
}
