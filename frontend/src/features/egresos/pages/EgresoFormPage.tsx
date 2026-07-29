import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Ban, Check, Loader2, Send, Trash2, X } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TextareaField } from "@/components/form/TextareaField"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { EgresoLineas } from "@/features/egresos/components/EgresoLineas"
import { EntregaDialog } from "@/features/egresos/components/EntregaDialog"
import {
  useActualizarEgreso,
  useAnularEgreso,
  useAprobarEgreso,
  useCrearEgreso,
  useDescartarEgreso,
  useEgreso,
  useEnviarEgreso,
  useRechazarEgreso,
} from "@/features/egresos/hooks/useEgresos"
import {
  aPayload,
  aPayloadEdicion,
  desdeEgreso,
  egresoSchema,
  VALORES_INICIALES,
} from "@/features/egresos/egresos.schema"
import {
  ESTADO_LABEL,
  ESTADO_VARIANT,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"

import type { EgresoFormValues } from "@/features/egresos/egresos.schema"
import type { LoteElegible } from "@/features/egresos/hooks/useBuscarLotes"

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  })

export function EgresoFormPage() {
  const { id: idParam } = useParams()
  const id = idParam ? Number(idParam) : undefined
  const esNuevo = id == null
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: egreso, isPending: cargando } = useEgreso(id)
  const crear = useCrearEgreso()
  const actualizar = useActualizarEgreso()
  const enviar = useEnviarEgreso()
  const aprobar = useAprobarEgreso()
  const rechazar = useRechazarEgreso()
  const anular = useAnularEgreso()
  const descartar = useDescartarEgreso()

  const [dialogoEntrega, setDialogoEntrega] = useState(false)
  const [dialogoDescartar, setDialogoDescartar] = useState(false)
  const [accionConMotivo, setAccionConMotivo] = useState<
    "rechazar" | "anular" | null
  >(null)
  const [motivo, setMotivo] = useState("")

  const { control, handleSubmit, reset } = useForm<EgresoFormValues>({
    resolver: zodResolver(egresoSchema),
    defaultValues: VALORES_INICIALES,
  })

  useEffect(() => {
    if (esNuevo || !egreso) return
    reset(desdeEgreso(egreso))
  }, [esNuevo, egreso, reset])

  const estado = egreso?.estado
  const esPropio = egreso?.solicitante.id === user?.id
  // El borrador es lo único editable, y solo por su dueño. Enviado, el pedido
  // ya es problema de otro.
  const editable = esNuevo || (estado === "BORRADOR" && esPropio)

  const puedeAprobar =
    estado === "PENDIENTE_APROBADOR" &&
    (user?.rol === "aprobador" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  const puedeEntregar =
    estado === "PENDIENTE_RESPONSABLE_ALMACEN" &&
    (user?.rol === "responsable_almacen" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  const puedeRechazar = puedeAprobar || puedeEntregar
  const puedeAnular =
    estado === "ENTREGADO" &&
    (user?.rol === "responsable_almacen" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")

  const ocupado =
    crear.isPending ||
    actualizar.isPending ||
    enviar.isPending ||
    aprobar.isPending ||
    rechazar.isPending ||
    anular.isPending ||
    descartar.isPending

  /**
   * Lotes que el pedido ya referencia. Van al selector porque su lista es una
   * búsqueda del servidor: sin esto, un lote ya elegido aparecería en blanco —
   * y encima puede haber quedado sin disponible justamente porque este pedido lo
   * reservó.
   */
  const lotesIniciales: LoteElegible[] = (egreso?.detalles ?? []).map((d) => ({
    id: d.ingresoDetalle.id,
    itemCodigo: d.ingresoDetalle.item.codigo,
    itemDescripcion: d.ingresoDetalle.item.descripcion,
    unidadMedida: d.ingresoDetalle.item.unidadMedida,
    fuente: d.ingresoDetalle.ingreso.fuenteFinanciamiento?.nombre ?? "Sin fuente",
    numeroIngreso: etiquetaNumero(d.ingresoDetalle.ingreso),
    fechaIngreso: d.ingresoDetalle.ingreso.fechaIngreso,
    disponible: Number(d.ingresoDetalle.saldoCantidad),
  }))

  async function guardar(valores: EgresoFormValues) {
    try {
      if (esNuevo) {
        const creado = await crear.mutateAsync(aPayload(valores))
        navigate(`/egresos/${creado.id}`)
      } else {
        await actualizar.mutateAsync({
          id: id as number,
          ...aPayloadEdicion(valores),
        })
      }
    } catch {
      // El toast lo emite la mutación (sin disponible, lote de otro almacén…).
    }
  }

  async function confirmarMotivo() {
    if (!accionConMotivo || id == null) return
    try {
      if (accionConMotivo === "rechazar") {
        await rechazar.mutateAsync({ id, motivo: motivo.trim() })
      } else {
        await anular.mutateAsync({ id, motivo: motivo.trim() })
      }
      setAccionConMotivo(null)
      setMotivo("")
    } catch {
      /* toast en la mutación */
    }
  }

  if (!esNuevo && cargando) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate("/egresos")}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {esNuevo ? "Nuevo pedido" : `Pedido ${etiquetaNumero(egreso!)}`}
          </h1>
          {egreso && (
            <p className="text-sm text-muted-foreground">
              {egreso.unidad.nombre} · {egreso.almacen.nombre} · solicitó{" "}
              {egreso.solicitante.nombre}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {estado && (
            <Badge variant={ESTADO_VARIANT[estado]}>
              {ESTADO_LABEL[estado]}
            </Badge>
          )}

          {editable && (
            <Button type="submit" form="egreso-form" disabled={ocupado}>
              {ocupado && <Loader2 className="size-4 animate-spin" />}
              {esNuevo ? "Crear borrador" : "Guardar"}
            </Button>
          )}
          {!esNuevo && editable && (
            <>
              <Button
                variant="secondary"
                disabled={ocupado}
                onClick={() => void enviar.mutateAsync(id as number)}
              >
                <Send className="size-4" />
                Enviar al jefe
              </Button>
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => setDialogoDescartar(true)}
              >
                <Trash2 className="size-4" />
                Descartar
              </Button>
            </>
          )}

          {puedeAprobar && (
            <Button
              disabled={ocupado}
              onClick={() => void aprobar.mutateAsync(id as number)}
            >
              <Check className="size-4" />
              Aprobar
            </Button>
          )}
          {puedeEntregar && (
            <Button disabled={ocupado} onClick={() => setDialogoEntrega(true)}>
              <Check className="size-4" />
              Entregar
            </Button>
          )}
          {puedeRechazar && (
            <Button
              variant="outline"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("rechazar")}
            >
              <X className="size-4" />
              Rechazar
            </Button>
          )}
          {puedeAnular && (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("anular")}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {estado === "ANULADO" && egreso?.motivoAnulacion && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Anulado:</span> {egreso.motivoAnulacion}
        </div>
      )}

      {editable ? (
        <form
          id="egreso-form"
          onSubmit={handleSubmit(guardar)}
          className="flex flex-col gap-4 rounded-md border p-4"
        >
          <TextareaField
            name="justificacion"
            label="Justificación"
            control={control}
            rows={2}
            placeholder="Para qué se pide el material"
            description="Máximo 300 caracteres."
            disabled={ocupado}
          />
          <EgresoLineas
            control={control}
            disabled={ocupado}
            lotesIniciales={lotesIniciales}
          />
        </form>
      ) : (
        egreso && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Justificación</p>
              <p className="text-sm">{egreso.justificacion}</p>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Entregado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {egreso.detalles.map((detalle) => (
                    <TableRow key={detalle.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{detalle.ingresoDetalle.item.descripcion}</span>
                          {detalle.observacion && (
                            <span className="text-xs text-muted-foreground">
                              {detalle.observacion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {detalle.ingresoDetalle.ingreso.fuenteFinanciamiento
                          ?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {etiquetaNumero(detalle.ingresoDetalle.ingreso)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {Number(detalle.cantidadSolicitada)}{" "}
                        {detalle.ingresoDetalle.item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {detalle.cantidadEntregada == null
                          ? "—"
                          : Number(detalle.cantidadEntregada)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}

      {egreso && egreso.historial.length > 0 && (
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-sm font-medium">Historial</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {egreso.historial.map((paso) => (
              <li key={paso.id} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">
                  {fechaHora(paso.createdAt)}
                </span>
                <span className="font-medium">
                  {ESTADO_LABEL[paso.estadoNuevo]}
                </span>
                <span className="text-muted-foreground">
                  · {paso.usuario.nombre}
                </span>
                {paso.motivo && (
                  <span className="w-full text-muted-foreground">
                    Motivo: {paso.motivo}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Se monta solo al abrirlo: así las cantidades propuestas se calculan en
          el montaje y no hace falta sincronizarlas con un efecto. */}
      {egreso && dialogoEntrega && (
        <EntregaDialog
          onClose={() => setDialogoEntrega(false)}
          egreso={egreso}
        />
      )}

      <AlertDialog
        open={accionConMotivo !== null}
        onOpenChange={(abierto) => !abierto && setAccionConMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accionConMotivo === "rechazar"
                ? "¿Rechazar el pedido?"
                : "¿Anular el egreso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accionConMotivo === "rechazar"
                ? "Vuelve al solicitante para que lo corrija y lo envíe de nuevo. Conserva su número."
                : "El material vuelve a sus lotes y queda una reversión en el Kardex. Anular dice que la salida nunca debió existir: no es el camino para material que se devuelve."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Motivo (obligatorio)"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={accionConMotivo === "anular" ? "destructive" : "default"}
              disabled={ocupado || motivo.trim().length === 0}
              onClick={(event) => {
                // Sin esto el diálogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarMotivo()
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogoDescartar} onOpenChange={setDialogoDescartar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar el borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina y libera el stock que tenía reservado. A diferencia del
              resto del sistema, un borrador sí se borra: todavía no es un
              documento ni movió existencias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={ocupado}
              onClick={(event) => {
                event.preventDefault()
                void descartar
                  .mutateAsync(id as number)
                  .then(() => navigate("/egresos"))
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
