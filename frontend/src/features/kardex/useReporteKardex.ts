import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { obtenerReporteKardex } from "@/features/kardex/kardex.api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

import type { QueryReporteKardex } from "@/features/kardex/kardex.types"

/**
 * Genera el reporte «Kardex» y lo abre en una PESTAÑA nueva, con el visor del
 * navegador. Hermano de `useReporteIngresos` y `useReporteEgresos`.
 *
 * A diferencia de la pantalla, el reporte NO exige un ítem: sale de todos los
 * del almacén, un bloque por ítem y fuente.
 */
/** En qué formato se emite. El contenido es el mismo en los dos. */
export type FormatoReporte = "pdf" | "excel"

export function useReporteKardex() {
  const [generando, setGenerando] = useState(false)
  const { user } = useAuth()

  async function abrirReporte(
    query: QueryReporteKardex,
    formato: FormatoReporte = "pdf"
  ) {
    // La pestaña se abre AHORA, dentro del gesto del clic: si se abriera
    // después de generar, el navegador la bloquearía como emergente.
    // El Excel NO abre pestaña: el navegador no lo renderiza, así que se descarga.
    const ventana = formato === "pdf" ? abrirPestanaPdf() : null
    setGenerando(true)
    try {
      const reporte = await obtenerReporteKardex(query)
      if (reporte.bloques.length === 0) {
        ventana?.close()
        toast.info("No hay movimientos para los filtros elegidos.")
        return
      }

      const datos = {
        reporte,
        // El encabezado del reporte nombra el almacén, que acá siempre es uno
        // solo: el kardex es por almacén y el backend ya lo resolvió.
        almacen: reporte.almacen.nombre,
        emitidoEn: new Date(),
        usuario: user?.nombre ?? "—",
      }

      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      if (formato === "excel") {
        const { descargarReporteKardexExcel } =
          await import("@/features/kardex/lib/reporte-kardex-excel")
        await descargarReporteKardexExcel(datos)
        return
      }

      const { crearReporteKardexPdf, nombreArchivoReporteKardex } =
        await import("@/features/kardex/lib/reporte-kardex-pdf")

      const documento = await crearReporteKardexPdf(datos)
      await mostrarPdf(ventana, documento, nombreArchivoReporteKardex(datos))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar el reporte: ${error.message}`
          : "No se pudo generar el reporte de kardex"
      )
    } finally {
      setGenerando(false)
    }
  }

  return { abrirReporte, generando }
}
