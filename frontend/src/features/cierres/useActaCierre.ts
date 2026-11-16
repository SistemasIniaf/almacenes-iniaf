import { useState } from "react"
import { toast } from "sonner"

import { obtenerCierre } from "@/features/cierres/cierres.api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

/**
 * Genera el acta de cierre en PDF y la abre en una PESTAÑA nueva, como todos los
 * PDF del sistema: la pestaña se abre dentro del gesto del clic, antes de
 * cualquier `await`. El acta siempre sale de lo GUARDADO en el cierre, así que
 * se puede reimprimir igual años después.
 */
export function useActaCierre() {
  const [generandoId, setGenerandoId] = useState<number | null>(null)

  async function abrirActa(id: number) {
    const ventana = abrirPestanaPdf()
    setGenerandoId(id)
    try {
      const cierre = await obtenerCierre(id)
      const { crearActaCierrePdf, nombreArchivoActa } =
        await import("@/features/cierres/lib/acta-cierre-pdf")
      const documento = await crearActaCierrePdf(cierre)
      await mostrarPdf(ventana, documento, nombreArchivoActa(cierre))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar el acta: ${error.message}`
          : "No se pudo generar el acta de cierre"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirActa, generandoId }
}
