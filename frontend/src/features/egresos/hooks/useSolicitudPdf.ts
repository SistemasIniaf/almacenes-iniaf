import { useState } from "react"
import { toast } from "sonner"

import { obtenerEgreso } from "@/features/egresos/egresos.api"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useAuth } from "@/features/auth/hooks/useAuth"

import type { Egreso } from "@/features/egresos/egresos.types"

/**
 * Abre la «Solicitud de materiales» en PDF, en una pestaña con el visor del
 * navegador. Hermano de `useNotaIngreso`.
 *
 * **Quién puede imprimirla**: almacén y administración
 * (`responsable_almacen` / `admin` / `super_admin`), NO el solicitante ni el
 * aprobador de unidad — el documento oficial lo emite el almacén (decisión del
 * encargado, 2026-07-29).
 *
 * OJO: esto oculta el botón, no es una barrera de seguridad. El PDF se arma en
 * el navegador con datos que el propio `GET /egresos/:id` ya devolvió, así que
 * un solicitante decidido puede ver los mismos datos por la API. Es una regla de
 * circuito, no un secreto: no hay endpoint de impresión que se pueda proteger.
 */
export function useSolicitudPdf() {
  const { user } = useAuth()
  const puedeImprimir = tienePermiso(user, "egresosImprimir")

  /** Id del egreso que se está generando, para el spinner de ESA fila. */
  const [generandoId, setGenerandoId] = useState<number | null>(null)

  async function abrirSolicitud(egreso: Egreso | number) {
    const id = typeof egreso === "number" ? egreso : egreso.id
    // La pestaña se abre AHORA, dentro del gesto del clic. Si se abriera al
    // terminar de generar el PDF, el navegador la bloquearía como emergente.
    const ventana = window.open("", "_blank")
    setGenerandoId(id)
    try {
      const completo =
        typeof egreso === "number" ? await obtenerEgreso(egreso) : egreso
      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      const { crearSolicitudPdf, nombreArchivo } = await import(
        "@/features/egresos/lib/solicitud-pdf"
      )
      const pdf = await crearSolicitudPdf(completo)
      // Si el navegador igual bloqueó la pestaña, se descarga el archivo.
      if (ventana) await pdf.open(ventana)
      else await pdf.download(nombreArchivo(completo))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar la solicitud: ${error.message}`
          : "No se pudo generar la solicitud"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirSolicitud, generandoId, puedeImprimir }
}
