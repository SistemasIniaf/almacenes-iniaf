import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { reporteEgresos } from "@/features/egresos/egresos.api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

import type { QueryEgresos } from "@/features/egresos/egresos.types"

/**
 * Los filtros de la pantalla, SIN paginación: el reporte es del rango entero,
 * no de la página que se esté mirando. La página arma este objeto una sola vez
 * y se lo pasa tanto al listado como al reporte — que es lo que garantiza que
 * el papel y la pantalla muestren lo mismo.
 */
export type FiltrosEgresos = Omit<QueryEgresos, "page" | "pageSize">

/** En qué formato se emite. El contenido es el mismo en los dos. */
export type FormatoReporte = "pdf" | "excel"

/**
 * Genera el reporte «Registro de egresos» y lo abre en una PESTAÑA nueva, con
 * el visor del navegador. Hermano de `useReporteIngresos`.
 */
export function useReporteEgresos() {
  const [generando, setGenerando] = useState(false)
  const { user } = useAuth()

  async function abrirReporte(
    filtros: FiltrosEgresos,
    almacen: string | null,
    formato: FormatoReporte = "pdf"
  ) {
    // La pestaña se abre AHORA, dentro del gesto del clic: si se abriera
    // después de generar, el navegador la bloquearía como emergente. El Excel
    // NO abre pestaña: el navegador no lo renderiza, así que se descarga.
    const ventana = formato === "pdf" ? abrirPestanaPdf() : null
    setGenerando(true)
    try {
      const filas = await reporteEgresos(filtros)
      const datos = {
        filas,
        almacen,
        emitidoEn: new Date(),
        usuario: user?.nombre ?? "—",
        desde: filtros.desde,
        hasta: filtros.hasta,
      }

      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      if (formato === "excel") {
        const { descargarReporteEgresosExcel } =
          await import("@/features/egresos/lib/reporte-egresos-excel")
        await descargarReporteEgresosExcel(datos)
        return
      }

      const { crearReporteEgresosPdf, nombreArchivoReporteEgresos } =
        await import("@/features/egresos/lib/reporte-egresos-pdf")

      const documento = await crearReporteEgresosPdf(datos)
      await mostrarPdf(ventana, documento, nombreArchivoReporteEgresos(datos))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar el reporte: ${error.message}`
          : "No se pudo generar el reporte de egresos"
      )
    } finally {
      setGenerando(false)
    }
  }

  return { abrirReporte, generando }
}
