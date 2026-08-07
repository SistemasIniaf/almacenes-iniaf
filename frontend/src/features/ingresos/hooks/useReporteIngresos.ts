import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { reporteIngresos } from "@/features/ingresos/ingresos.api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

import type { QueryIngresos } from "@/features/ingresos/ingresos.types"

/**
 * Los filtros de la pantalla, SIN paginación: el reporte es del rango entero,
 * no de la página que se esté mirando. La página arma este objeto una sola vez
 * y se lo pasa tanto al listado como al reporte — que es lo que garantiza que
 * el papel y la pantalla muestren lo mismo.
 */
export type FiltrosIngresos = Omit<QueryIngresos, "page" | "pageSize">

/**
 * Genera el reporte «Registro de ingresos» y lo abre en una PESTAÑA nueva, con
 * el visor del navegador.
 *
 * Los datos los agrega el servidor (`GET /ingresos/reporte`, sin paginar) con
 * los MISMOS filtros que la pantalla: el papel tiene que coincidir con lo que
 * se está viendo.
 */
/** En qué formato se emite. El contenido es el mismo en los dos. */
export type FormatoReporte = "pdf" | "excel"

export function useReporteIngresos() {
  const [generando, setGenerando] = useState(false)
  const { user } = useAuth()

  async function abrirReporte(
    filtros: FiltrosIngresos,
    almacen: string | null,
    formato: FormatoReporte = "pdf"
  ) {
    // La pestaña se abre AHORA, dentro del gesto del clic: si se abriera
    // después de generar, el navegador la bloquearía como emergente. El Excel
    // NO abre pestaña: el navegador no lo renderiza, así que se descarga —
    // abrirle una lo dejaría mirando una página en blanco.
    const ventana = formato === "pdf" ? abrirPestanaPdf() : null
    setGenerando(true)
    try {
      const filas = await reporteIngresos(filtros)
      const datos = {
        filas,
        almacen,
        emitidoEn: new Date(),
        usuario: user?.nombre ?? "—",
        desde: filtros.desde,
        hasta: filtros.hasta,
      }

      // Cada librería se carga sólo si se la usa: ni pdfmake ni exceljs pesan
      // en el bundle de quien nunca emite un reporte.
      if (formato === "excel") {
        const { descargarReporteIngresosExcel } =
          await import("@/features/ingresos/lib/reporte-ingresos-excel")
        await descargarReporteIngresosExcel(datos)
        return
      }

      const { crearReporteIngresosPdf, nombreArchivoReporteIngresos } =
        await import("@/features/ingresos/lib/reporte-ingresos-pdf")

      const documento = await crearReporteIngresosPdf(datos)
      await mostrarPdf(ventana, documento, nombreArchivoReporteIngresos(datos))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar el reporte: ${error.message}`
          : "No se pudo generar el reporte de ingresos"
      )
    } finally {
      setGenerando(false)
    }
  }

  return { abrirReporte, generando }
}
