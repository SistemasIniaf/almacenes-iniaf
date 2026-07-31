import { useState } from "react"
import { toast } from "sonner"

import { obtenerEgreso } from "@/features/egresos/egresos.api"
import { etiquetaNumero } from "@/features/egresos/egresos.types"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useVisorPdf } from "@/hooks/use-visor-pdf"

import type { Egreso } from "@/features/egresos/egresos.types"

/**
 * Genera la «Solicitud de materiales» en PDF y la deja lista para el visor
 * embebido (`PdfDialog`). Hermano de `useNotaIngreso`.
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
  const { pdf, mostrarPdf, cerrarPdf } = useVisorPdf()

  async function abrirSolicitud(egreso: Egreso | number) {
    const id = typeof egreso === "number" ? egreso : egreso.id
    setGenerandoId(id)
    try {
      const completo =
        typeof egreso === "number" ? await obtenerEgreso(egreso) : egreso
      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      const { crearSolicitudPdf, nombreArchivo } = await import(
        "@/features/egresos/lib/solicitud-pdf"
      )
      const documento = await crearSolicitudPdf(completo)
      mostrarPdf(await documento.getBlob(), {
        nombre: nombreArchivo(completo),
        etiqueta: `Pedido ${etiquetaNumero(completo)}`,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `No se pudo generar la solicitud: ${error.message}`
          : "No se pudo generar la solicitud"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirSolicitud, generandoId, puedeImprimir, pdf, cerrarPdf }
}
