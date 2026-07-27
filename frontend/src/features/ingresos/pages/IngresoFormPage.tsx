import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Ban, Check, Loader2, Printer, Save } from "lucide-react"

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
import { FieldGroup } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { DatePickerField } from "@/components/form/DatePickerField"
import { InputField } from "@/components/form/InputField"
import { SelectField } from "@/components/form/SelectField"
import { TextareaField } from "@/components/form/TextareaField"
import { ComboboxField } from "@/components/form/ComboboxField"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useFuentesActivas } from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"
import { useProveedoresActivos } from "@/features/proveedores/useProveedores"
import { IngresoLineas } from "@/features/ingresos/components/IngresoLineas"
import {
  useActualizarIngreso,
  useAnularIngreso,
  useConfirmarIngreso,
  useCrearIngreso,
  useIngreso,
  useSolicitadores,
  useUnidadesDeAlmacen,
} from "@/features/ingresos/hooks/useIngresos"
import { useNotaIngreso } from "@/features/ingresos/hooks/useNotaIngreso"
import {
  aPayload,
  desdeIngreso,
  ingresoSchema,
  VALORES_INICIALES,
} from "@/features/ingresos/ingresos.schema"
import {
  ESTADO_LABEL,
  etiquetaNumero,
} from "@/features/ingresos/ingresos.types"

import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"

const ESTADO_VARIANT: Record<string, "secondary" | "default" | "destructive"> =
  {
    BORRADOR: "secondary",
    CONFIRMADO: "default",
    ANULADO: "destructive",
  }

export function IngresoFormPage() {
  const { id: idParam } = useParams()
  const id = idParam ? Number(idParam) : undefined
  const esNuevo = id == null
  const navigate = useNavigate()
  const { user } = useAuth()
  const esResponsable = user?.rol === "responsable_almacen"

  const { data: ingreso, isPending: cargando } = useIngreso(id)
  const crear = useCrearIngreso()
  const actualizar = useActualizarIngreso()
  const confirmar = useConfirmarIngreso()
  const anular = useAnularIngreso()

  const [dialogoAnular, setDialogoAnular] = useState(false)
  const [motivo, setMotivo] = useState("")
  const { abrirNota, generandoId } = useNotaIngreso()

  const { control, handleSubmit, reset, watch, getValues, trigger } =
    useForm<IngresoFormValues>({
      resolver: zodResolver(ingresoSchema),
      defaultValues: VALORES_INICIALES,
    })

  // Carga inicial: nuevo (preseteando el almacén del responsable) o existente.
  useEffect(() => {
    if (esNuevo) {
      reset({
        ...VALORES_INICIALES,
        almacenId:
          esResponsable && user?.almacenId ? String(user.almacenId) : "",
      })
    } else if (ingreso) {
      reset(desdeIngreso(ingreso))
    }
  }, [esNuevo, ingreso, esResponsable, user?.almacenId, reset])

  const estado = ingreso?.estado ?? "BORRADOR"
  const soloLectura = !esNuevo && estado !== "BORRADOR"
  const guardando = crear.isPending || actualizar.isPending

  const almacenIdSel = watch("almacenId")
  const almacenNum = almacenIdSel ? Number(almacenIdSel) : undefined

  const { data: almacenes = [] } = useAlmacenesActivos()
  const { data: proveedores = [] } = useProveedoresActivos()
  const { data: fuentes = [] } = useFuentesActivas()
  const { data: solicitadores = [] } = useSolicitadores()
  const { data: unidades = [] } = useUnidadesDeAlmacen(almacenNum)

  // El responsable no elige almacén (usa el suyo); admin sí, solo al crear.
  const almacenEditable = esNuevo && !esResponsable
  // Nombre a mostrar cuando el almacén no es editable (en vez del id).
  const nombreAlmacen =
    ingreso?.almacen.nombre ??
    almacenes.find((a) => String(a.id) === almacenIdSel)?.nombre ??
    ""

  async function guardar(v: IngresoFormValues) {
    try {
      if (esNuevo) {
        const creado = await crear.mutateAsync(
          aPayload(v, { incluirAlmacen: !esResponsable })
        )
        navigate(`/ingresos/${creado.id}`)
      } else {
        await actualizar.mutateAsync({
          id: id as number,
          ...aPayload(v, { incluirAlmacen: false }),
        })
      }
    } catch {
      // toast lo emite la mutación
    }
  }

  async function handleConfirmar() {
    // Guarda lo que haya en pantalla y luego confirma (el backend valida respaldos).
    const ok = await trigger()
    if (!ok) return
    try {
      await actualizar.mutateAsync({
        id: id as number,
        ...aPayload(getValues(), { incluirAlmacen: false }),
      })
      await confirmar.mutateAsync(id as number)
    } catch {
      // toast lo emite la mutación (lista lo que falta)
    }
  }

  async function handleAnular() {
    try {
      await anular.mutateAsync({ id: id as number, motivo: motivo.trim() })
      setDialogoAnular(false)
      setMotivo("")
    } catch {
      /* toast en la mutación */
    }
  }

  if (!esNuevo && cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ingresos")}
            aria-label="Volver"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {esNuevo
                ? "Nuevo ingreso"
                : `Ingreso ${etiquetaNumero(ingreso ?? { numero: null, gestion: null })}`}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={ESTADO_VARIANT[estado]}>
                {ESTADO_LABEL[estado]}
              </Badge>
              {/* El almacén se muestra acá y no como campo del formulario:
                  salvo que un admin lo esté eligiendo, es un dato fijo. */}
              {nombreAlmacen && <span>{nombreAlmacen}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {!soloLectura && (
            <>
              <Button
                type="submit"
                form="ingreso-form"
                variant="outline"
                disabled={guardando}
              >
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar borrador
              </Button>
              {!esNuevo && (
                <Button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={guardando || confirmar.isPending}
                >
                  {confirmar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Confirmar
                </Button>
              )}
            </>
          )}
          {/* Un borrador no se imprime: todavía no tiene número. */}
          {!esNuevo && estado !== "BORRADOR" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => ingreso && abrirNota(ingreso)}
              disabled={generandoId != null}
            >
              {generandoId != null ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Imprimir
            </Button>
          )}
          {estado === "CONFIRMADO" && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDialogoAnular(true)}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {estado === "ANULADO" && ingreso?.motivoAnulacion && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Anulado:</span>{" "}
          {ingreso.motivoAnulacion}
        </div>
      )}

      <form id="ingreso-form" onSubmit={handleSubmit(guardar)}>
        <div className="rounded-md border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
            {/*
              1. Almacén — SOLO cuando un admin crea el ingreso y tiene que
              elegir a cuál entra. Para el responsable es siempre el suyo, así
              que no se pide: el nombre figura en el encabezado de la página.
            */}
            {almacenEditable && (
              <>
                <div className="lg:col-span-4">
                  <SelectField
                    name="almacenId"
                    label="Almacén"
                    control={control}
                    options={almacenes.map((a) => ({
                      value: String(a.id),
                      label: a.nombre,
                    }))}
                    placeholder="Elegí el almacén"
                    disabled={soloLectura}
                  />
                </div>
                {/*
                  Relleno para que el almacén ocupe su propia línea y las filas
                  de abajo sigan cerrando en 12 tal cual las ordenaste. Sin esto,
                  con el admin la primera fila suma 17 (4+3+2+2+6) y el proveedor
                  se cae de línea arrastrando todo el resto. Solo desde lg: más
                  abajo la grilla es de 1 o 2 columnas y una celda vacía se vería.
                */}
                <div className="hidden lg:col-span-8 lg:block" aria-hidden />
              </>
            )}

            {/* 2. Fecha de remisión (¼) */}
            <div className="lg:col-span-3">
              <DatePickerField
                name="fechaRemision"
                label="Fecha de remisión"
                control={control}
                required={false}
                placeholder="Elija la fecha"
                disabled={soloLectura}
              />
            </div>

            {/* 3. Nota de remisión (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="notaRemision"
                label="Nota de remisión"
                control={control}
                required={false}
                disabled={soloLectura}
              />
            </div>

            {/* 4. Nº de factura (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="numeroFactura"
                label="Nº de factura"
                control={control}
                required={false}
                disabled={soloLectura}
              />
            </div>

            {/* 5. Proveedor — cierra la fila: 3+2+2+5 = 12. */}
            <div className="lg:col-span-5">
              <ComboboxField
                name="proveedorId"
                label="Proveedor"
                control={control}
                required={false}
                options={proveedores.map((p) => ({
                  value: String(p.id),
                  label: p.nombre,
                }))}
                placeholder="Elegí un proveedor"
                vacio="Ningún proveedor coincide."
                disabled={soloLectura}
              />
            </div>

            {/* 10. Fecha del informe / acta (¼) */}
            <div className="lg:col-span-3">
              <DatePickerField
                name="fechaInformeConformidad"
                label="Fecha del informe/acta"
                control={control}
                required={false}
                placeholder="Elija la fecha"
                disabled={soloLectura}
              />
            </div>

            {/* 9. Informe / acta de conformidad (¼) */}
            <div className="lg:col-span-3">
              <InputField
                name="informeConformidad"
                label="Informe/acta de conformidad"
                control={control}
                required={false}
                disabled={soloLectura}
              />
            </div>

            {/* 11. Responsable / Comisión de recepción (¼) */}
            <div className="lg:col-span-6">
              <ComboboxField
                name="responsableConformidadId"
                label="Responsable / Comisión de recepción"
                control={control}
                required={false}
                options={solicitadores.map((u) => ({
                  value: String(u.id),
                  label: u.nombre,
                  busqueda: u.usuario,
                }))}
                placeholder="Elegí un solicitador"
                vacio="Ningún solicitador coincide."
                disabled={soloLectura}
              />
            </div>

            {/* 12. Unidad solicitante (½) */}
            <div className="lg:col-span-4">
              <ComboboxField
                name="unidadSolicitanteId"
                label="Unidad solicitante"
                control={control}
                required={false}
                options={unidades.map((u) => ({
                  value: String(u.id),
                  label: u.nombre,
                  busqueda: u.sigla,
                }))}
                placeholder={
                  almacenNum ? "Elegí una unidad" : "Elegí primero el almacén"
                }
                vacio="Ninguna unidad coincide."
                disabled={soloLectura || !almacenNum}
              />
            </div>

            {/* 6. Proceso Nº / C31 (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="procesoC31"
                label="Proceso Nº / C31"
                control={control}
                required={false}
                disabled={soloLectura}
              />
            </div>

            {/* 7. Certificación (¼) — la puse junto a los otros nº de documento. Decime si va en otro lado. */}
            <div className="lg:col-span-2">
              <InputField
                name="certificacion"
                label="Certificación"
                control={control}
                required={false}
                disabled={soloLectura}
              />
            </div>

            {/* 8. Fuente de financiamiento (½) */}
            <div className="lg:col-span-4">
              <ComboboxField
                name="fuenteFinanciamientoId"
                label="Fuente de financiamiento"
                control={control}
                required={false}
                options={fuentes.map((f) => ({
                  value: String(f.id),
                  label: f.nombre,
                }))}
                placeholder="Elegí una fuente"
                vacio="Ninguna fuente coincide."
                disabled={soloLectura}
              />
            </div>

            {/* 13. Observación (ancho completo) */}
            <div className="md:col-span-2 lg:col-span-12">
              <TextareaField
                name="observacion"
                label="Observación"
                control={control}
                required={false}
                rows={2}
                disabled={soloLectura}
              />
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <IngresoLineas
              control={control}
              disabled={soloLectura}
              // El selector de ítems busca contra el servidor: los ítems que ya
              // tiene el ingreso viajan aparte para que se vean sin buscarlos.
              itemsIniciales={ingreso?.detalles.map((d) => d.item) ?? []}
            />
          </div>
        </div>
      </form>

      {/* Diálogo de anulación */}
      <AlertDialog open={dialogoAnular} onOpenChange={setDialogoAnular}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este ingreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Revierte el material del stock (movimiento de reversión en el
              Kardex) y queda registrado quién, cuándo y por qué. No se elimina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación..."
              rows={3}
            />
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anular.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={anular.isPending || motivo.trim() === ""}
              onClick={(e) => {
                e.preventDefault()
                void handleAnular()
              }}
            >
              Anular ingreso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
