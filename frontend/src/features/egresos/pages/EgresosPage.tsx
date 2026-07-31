import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  TrendingUp,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  FileText,
  Search,
  Send,
  Trash2,
} from "lucide-react"

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
import { BadgeEstado } from "@/components/data/BadgeEstado"
import { DataPagination } from "@/components/data/DataPagination"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { EnviarDialog } from "@/features/egresos/components/EnviarDialog"
import { HistorialSheet } from "@/features/egresos/components/HistorialSheet"
import { PdfDialog } from "@/components/pdf/PdfDialog"
import {
  useDescartarEgreso,
  useEgresos,
} from "@/features/egresos/hooks/useEgresos"
import { useSolicitudPdf } from "@/features/egresos/hooks/useSolicitudPdf"
import { IconAction } from "@/components/data/IconAction"
import { MACIZO, TONO_ACCION } from "@/components/data/tonos-accion"
import {
  ESTADO_DETALLE,
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { usePagination } from "@/hooks/use-pagination"

import type {
  EgresoListItem,
  EstadoEgreso,
} from "@/features/egresos/egresos.types"

type FiltroEstado = EstadoEgreso | "todos"

const ESTADOS: EstadoEgreso[] = [
  "BORRADOR",
  "PENDIENTE_APROBADOR",
  "PENDIENTE_RESPONSABLE_ALMACEN",
  "ENTREGADO",
  "ANULADO",
]

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—"

export function EgresosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const puedeCrear = tienePermiso(user, "egresosCrear")
  const { abrirSolicitud, generandoId, puedeImprimir, pdf, cerrarPdf } =
    useSolicitudPdf()

  // Quien decide algo en el circuito arranca en SU bandeja: lo que espera su
  // firma. El resto ve todo lo que le toca por alcance.
  const tieneBandeja =
    user?.rol === "aprobador" || user?.rol === "responsable_almacen"

  // Las tarjetas de la home enlazan acá con el estado ya elegido (?estado=…).
  // Es solo el valor INICIAL: a partir de ahí manda el selector, que no escribe
  // en la URL. Si viene un estado, la bandeja arranca apagada — combinarlos daría
  // cero resultados en cuanto el estado pedido no sea el de la bandeja del rol.
  const estadoUrl = params.get("estado") as EstadoEgreso | null
  const estadoInicial: FiltroEstado =
    estadoUrl && ESTADOS.includes(estadoUrl) ? estadoUrl : "todos"

  const descartar = useDescartarEgreso()
  // Enviar y descartar piden confirmación: los dos son sin vuelta atrás.
  const [aEnviar, setAEnviar] = useState<EgresoListItem | null>(null)
  const [aDescartar, setADescartar] = useState<EgresoListItem | null>(null)
  const [historialDe, setHistorialDe] = useState<number | null>(null)

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>(estadoInicial)
  const [soloBandeja, setSoloBandeja] = useState(
    tieneBandeja && estadoInicial === "todos"
  )
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { data, isPending, isError, error } = useEgresos({
    page,
    pageSize,
    q: busquedaDiferida || undefined,
    estado: estado === "todos" ? undefined : estado,
    pendientesMios: soloBandeja || undefined,
  })

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  const egresos = data?.data ?? []
  const veVariasUnidades =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "responsable_almacen" ||
    user?.rol === "observador_almacen"
  // El solicitador solo ve SUS pedidos (lo aplica el alcance del backend), así
  // que la columna repetiría su nombre en todas las filas. Para el resto sí
  // distingue de quién es cada pedido.
  const veVariosSolicitantes = user?.rol !== "solicitador"

  /**
   * Editar, enviar y descartar solo valen sobre un borrador PROPIO — es lo mismo
   * que exige el backend (`exigirSolicitante` + `exigirEstado`). Se compara por
   * id de solicitante y no por rol: un admin ve borradores ajenos en el listado y
   * tampoco puede tocarlos.
   */
  const puedeGestionar = (egreso: EgresoListItem) =>
    egreso.estado === "BORRADOR" && egreso.solicitante.id === user?.id

  // Fijas: Nº, Fecha, Justificación, Ítems, Estado y Acciones — esta última
  // siempre está, porque «Ver historial» lo puede usar cualquier rol.
  const columnas =
    6 + (veVariasUnidades ? 1 : 0) + (veVariosSolicitantes ? 1 : 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de material: los arma el solicitante, los aprueba el
            aprobador de su unidad y los entrega el responsable del almacén.
          </p>
        </div>

        {puedeCrear && (
          <Button onClick={() => navigate("/egresos/nuevo")}>
            <Plus className="size-4" />
            Nuevo pedido
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
            placeholder="Buscar por justificación..."
            className="pl-9"
            aria-label="Buscar egresos"
          />
        </div>

        {tieneBandeja && (
          <Button
            variant={soloBandeja ? "default" : "outline"}
            onClick={() => cambiarFiltro(() => setSoloBandeja(!soloBandeja))}
          >
            <Inbox className="size-4" />
            {soloBandeja ? "Solo mi bandeja" : "Todos"}
          </Button>
        )}

        <Select
          value={estado}
          onValueChange={(valor) =>
            cambiarFiltro(() => setEstado(valor as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="todos">Todos los estados</SelectItem>
            {/* En el selector va la etiqueta LARGA: hay ancho de sobra y elegir
                un filtro es justo cuando conviene saber a quién le toca. */}
            {ESTADOS.map((valor) => (
              <SelectItem key={valor} value={valor}>
                {ESTADO_DETALLE[valor]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha</TableHead>
              {veVariasUnidades && <TableHead>Unidad</TableHead>}
              {veVariosSolicitantes && <TableHead>Solicitante</TableHead>}
              <TableHead>Justificación</TableHead>
              <TableHead className="text-center">Ítems</TableHead>
              <TableHead>Estado</TableHead>
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
                  {getApiErrorMessage(error, "No se pudieron cargar los egresos.")}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && egresos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {soloBandeja
                    ? "No tenés pedidos esperando tu decisión."
                    : busquedaDiferida || estado !== "todos"
                      ? "Ningún pedido coincide con los filtros."
                      : "Todavía no hay pedidos."}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              egresos.map((egreso) => (
                <TableRow
                  key={egreso.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/egresos/${egreso.id}`)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {etiquetaNumero(egreso)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fecha(egreso.fechaEnvio ?? egreso.createdAt)}
                  </TableCell>
                  {veVariasUnidades && (
                    <TableCell className="text-muted-foreground">
                      {egreso.unidad.sigla}
                    </TableCell>
                  )}
                  {veVariosSolicitantes && (
                    <TableCell>{egreso.solicitante.nombre}</TableCell>
                  )}
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {egreso.justificacion}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {egreso._count.detalles}
                  </TableCell>
                  <TableCell>
                    <BadgeEstado tono={ESTADO_PUNTO[egreso.estado]}>
                      {ESTADO_LABEL[egreso.estado]}
                    </BadgeEstado>
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    // La fila navega al detalle: los botones no deben arrastrar
                    // ese clic.
                    onClick={(event) => event.stopPropagation()}
                  >
                    {puedeGestionar(egreso) && (
                      <>
                        <IconAction
                          icono={Pencil}
                          etiqueta="Editar el pedido"
                          onClick={() => navigate(`/egresos/${egreso.id}`)}
                          className={TONO_ACCION.editar}
                        />
                        <IconAction
                          icono={Send}
                          etiqueta="Enviar a aprobador unidad"
                          onClick={() => setAEnviar(egreso)}
                          className={TONO_ACCION.enviar}
                        />
                      </>
                    )}
                    {puedeImprimir && egreso.estado !== "BORRADOR" && (
                      <IconAction
                        icono={generandoId === egreso.id ? Loader2 : FileText}
                        etiqueta="Ver la solicitud en PDF"
                        onClick={() => void abrirSolicitud(egreso.id)}
                        disabled={generandoId === egreso.id}
                        className={TONO_ACCION.pdf}
                        // Macizo (relleno del color del texto, trazo del color
                        // del fondo) y un punto más grande que el resto: es la
                        // acción que más se busca en la fila.
                        //
                        // El `size-5` va SIEMPRE, también con el spinner: si el
                        // tamaño cambiara al empezar a generar, la fila daría un
                        // salto. Lo único que se saca es el relleno — un
                        // `Loader2` macizo sería una mancha girando.
                        iconoClassName={
                          generandoId === egreso.id ? "size-5" : `size-5 ${MACIZO}`
                        }
                      />
                    )}
                    {/* Disponible para todos: ver quién movió el pedido y cuándo
                        es lo que más se consulta, y hasta ahora costaba entrar a
                        la ficha. */}
                    <IconAction
                      icono={TrendingUp}
                      etiqueta="Ver historial"
                      onClick={() => setHistorialDe(egreso.id)}
                      className={TONO_ACCION.ver}
                    />

                    {/* Descartar va SIEMPRE al final: es la única irreversible,
                        y separarla de las demás baja la chance de un clic por
                        inercia. */}
                    {puedeGestionar(egreso) && (
                      <IconAction
                        icono={Trash2}
                        etiqueta="Descartar el pedido"
                        destructiva
                        onClick={() => setADescartar(egreso)}
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
          entidad="egresos"
        />
      )}

      {aEnviar && (
        <EnviarDialog
          egresoId={aEnviar.id}
          onClose={() => setAEnviar(null)}
        />
      )}

      {/* Se monta solo al abrirse: el historial no viaja en el listado y el
          panel tiene que pedir el detalle del pedido. */}
      {historialDe != null && (
        <HistorialSheet
          egresoId={historialDe}
          onClose={() => setHistorialDe(null)}
        />
      )}

      {pdf && (
        <PdfDialog
          titulo="Solicitud de materiales"
          {...pdf}
          onClose={cerrarPdf}
        />
      )}

      <AlertDialog
        open={aDescartar !== null}
        onOpenChange={(abierto) => !abierto && setADescartar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar el pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina y libera el stock que tenía reservado. A diferencia del
              resto del sistema, un pedido sin enviar sí se borra: todavía no es
              un documento ni movió existencias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descartar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={descartar.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!aDescartar) return
                void descartar
                  .mutateAsync(aDescartar.id)
                  .then(() => setADescartar(null))
                  .catch(() => undefined)
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
