import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Ban,
  Check,
  TrendingUp,
  Loader2,
  FileText,
  Save,
  Send,
  X,
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
import { BadgeEstado } from "@/components/data/BadgeEstado"
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
import { EnviarDialog } from "@/features/egresos/components/EnviarDialog"
import { HistorialSheet } from "@/features/egresos/components/HistorialSheet"
import {
  useActualizarEgreso,
  useAnularEgreso,
  useAprobarEgreso,
  useCrearEgreso,
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
import { useSolicitudPdf } from "@/features/egresos/hooks/useSolicitudPdf"
import { urlArchivo } from "@/lib/files"
import {
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"

import type { FieldErrors } from "react-hook-form"
import type { EgresoFormValues } from "@/features/egresos/egresos.schema"
import type { LoteElegible } from "@/features/egresos/hooks/useBuscarLotes"

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
  const { abrirSolicitud, generandoId, puedeImprimir } = useSolicitudPdf()

  const [dialogoEntrega, setDialogoEntrega] = useState(false)
  const [dialogoEnviar, setDialogoEnviar] = useState(false)
  const [historialAbierto, setHistorialAbierto] = useState(false)
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
    anular.isPending

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
    imagen: urlArchivo(d.ingresoDetalle.item.imagenUrl),
    fuente:
      d.ingresoDetalle.ingreso.fuenteFinanciamiento?.nombre ?? "Sin fuente",
    numeroIngreso: etiquetaNumero(d.ingresoDetalle.ingreso),
    disponible: Number(d.ingresoDetalle.saldoCantidad),
  }))

  /**
   * El formulario no se envió porque algo no validó. Sin esto, el botón parecía
   * no hacer NADA: los errores de las líneas quedan dentro de sus tarjetas, más
   * abajo, y si no agregaste ninguna el error del arreglo no lo pintaba ningún
   * campo. El toast dice qué falta y `handleSubmit` ya lleva el foco al primer
   * campo con error.
   */
  function avisarInvalido(errores: FieldErrors<EgresoFormValues>) {
    if (errores.detalles) {
      const raiz = (errores.detalles as { root?: { message?: string } }).root
      toast.error(
        raiz?.message ??
          errores.detalles.message ??
          "Revisá los ítems del pedido: hay líneas incompletas."
      )
      return
    }
    toast.error("Faltan datos: revisá los campos marcados en rojo.")
  }

  async function guardar(valores: EgresoFormValues) {
    try {
      if (esNuevo) {
        // Al listado, no a la ficha del pedido recién creado: guardar termina la
        // tarea, y quedarse en el formulario se leía como que no había pasado
        // nada. Desde la tabla se ve el pedido con su estado y a un clic están
        // sus acciones (enviar, editar, descartar), que viven ahí.
        await crear.mutateAsync(aPayload(valores))
        navigate("/egresos")
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
            className="mb-1 -ml-2"
            onClick={() => navigate("/egresos")}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          {/* Sin número todavía (borrador): «Pedido» a secas. Antes salía
              «Pedido —», con un guión suelto que no dice nada. La unidad, el
              almacén y el solicitante NO van acá: están en el bloque de datos,
              que se muestra igual en edición y en lectura. */}
          <h1 className="text-2xl font-semibold tracking-tight">
            {esNuevo
              ? "Nuevo pedido"
              : egreso?.numero == null
                ? "Pedido"
                : `Pedido ${etiquetaNumero(egreso)}`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {estado && (
            <BadgeEstado tono={ESTADO_PUNTO[estado]}>
              {ESTADO_LABEL[estado]}
            </BadgeEstado>
          )}

          {/* Acá arriba van solo las acciones sobre el DOCUMENTO (enviar,
              aprobar, entregar, anular, imprimir). El submit del formulario está
              al pie, dentro del propio form, como en el de ingresos.

              Descartar tampoco está acá: es una acción de limpieza, no un paso
              del circuito. Vive en el listado, como acción de fila. */}
          {!esNuevo && (
            <Button
              variant="outline"
              onClick={() => setHistorialAbierto(true)}
            >
              <TrendingUp className="size-4" />
              Historial
            </Button>
          )}

          {!esNuevo && editable && (
            <Button
              variant="secondary"
              disabled={ocupado}
              onClick={() => setDialogoEnviar(true)}
            >
              <Send className="size-4" />
              Enviar a aprobador unidad
            </Button>
          )}

          {/* Un borrador todavía no tiene número, así que no hay documento que
              imprimir; recién enviado se vuelve uno. */}
          {egreso && estado !== "BORRADOR" && puedeImprimir && (
            <Button
              variant="outline"
              disabled={generandoId === egreso.id}
              onClick={() => void abrirSolicitud(egreso)}
            >
              {/* Mismo icono que en el listado. Acá NO va en rojo: dentro de un
                  botón con texto, el rojo se lee como acción peligrosa. */}
              {generandoId === egreso.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Ver PDF
            </Button>
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

      {/* De quién es el pedido. No se elige: el almacén y la unidad los hereda
          del solicitante (ver "Regla de negocio crítica" en CLAUDE.md), así que
          se muestran como dato, no como campo. Va FUERA del formulario para que
          también se vea en la ficha de solo lectura — es el único lugar donde
          figuran, desde que se quitó la línea repetida bajo el título. Al crear
          salen del perfil (el registro todavía no existe); después, del propio
          egreso, que es la fuente de verdad. */}
      <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/40 p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Solicitante</p>
          <p className="text-sm font-medium">
            {egreso?.solicitante.nombre ?? user?.nombre ?? "—"}
          </p>
          {(egreso?.solicitante.cargo ?? user?.cargo) && (
            <p className="text-xs text-muted-foreground">
              {egreso?.solicitante.cargo ?? user?.cargo}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Unidad solicitante</p>
          <p className="text-sm font-medium">
            {egreso?.unidad.nombre ?? user?.unidad?.nombre ?? "—"}
          </p>
          {(egreso?.unidad.sigla ?? user?.unidad?.sigla) && (
            <p className="text-xs text-muted-foreground">
              {egreso?.unidad.sigla ?? user?.unidad?.sigla}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Almacén</p>
          <p className="text-sm font-medium">
            {egreso?.almacen.nombre ?? user?.almacen?.nombre ?? "—"}
          </p>
        </div>
      </div>

      {editable ? (
        <form
          id="egreso-form"
          onSubmit={handleSubmit(guardar, avisarInvalido)}
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

          {/* Acción principal al pie del formulario, dentro del card — igual que
              el de ingresos. Queda al final de lo que hay que completar, no en
              la barra de arriba junto a las acciones del documento. */}
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={ocupado}>
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        egreso && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Justificación</p>
              <p className="text-sm">{egreso.justificacion}</p>
            </div>

            <div className="rounded-md border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Ingreso</TableHead>
                    {/* La unidad va en columna propia, no pegada a cada número:
                        así no hay que pluralizarla («4 PIEZA») ni inventar reglas
                        para las abreviaturas, que son invariables (KG, LT, M2).
                        Es la misma disposición que el PDF de la solicitud. */}
                    <TableHead className="text-center">Unidad</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Entregado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {egreso.detalles.map((detalle) => (
                    <TableRow key={detalle.id}>
                      <TableCell>
                        {detalle.ingresoDetalle.item.descripcion}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {detalle.ingresoDetalle.ingreso.fuenteFinanciamiento
                          ?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {etiquetaNumero(detalle.ingresoDetalle.ingreso)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                        {detalle.ingresoDetalle.item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(detalle.cantidadSolicitada)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
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

      {/* El historial NO se muestra acá: se abre a pedido, con el botón
          «Historial» de la barra de arriba, igual que desde el listado. La ficha
          es para trabajar el pedido; la traza se consulta cuando hace falta. */}
      {historialAbierto && id != null && (
        <HistorialSheet
          egresoId={id}
          onClose={() => setHistorialAbierto(false)}
        />
      )}

      

      {/* Se monta solo al abrirse: así consulta el aprobador recién cuando hace
          falta. */}
      {dialogoEnviar && id != null && (
        <EnviarDialog egresoId={id} onClose={() => setDialogoEnviar(false)} />
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
    </div>
  )
}
