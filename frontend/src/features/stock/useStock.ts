import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/hooks/useAuth"

import {
  listarPartidasConStock,
  listarStock,
  obtenerReporteStock,
} from "@/features/stock/stock.api"

import type { QueryStock } from "@/features/stock/stock.types"

export function useStock(query: QueryStock) {
  return useQuery({
    queryKey: ["stock", query],
    queryFn: () => listarStock(query),
    placeholderData: keepPreviousData,
  })
}

/**
 * Partidas con existencias. Se pasan los mismos filtros de almacén y fuente
 * (no el de partida) para que el selector no ofrezca opciones sin resultados.
 */
export function usePartidasConStock(query: QueryStock) {
  return useQuery({
    queryKey: ["stock", "partidas", query],
    queryFn: () => listarPartidasConStock(query),
    staleTime: 60_000,
  })
}

/**
 * Genera un reporte de existencias y lo abre en una pestaña con el visor de PDF
 * del navegador.
 *
 * `detalle` es «Estado de almacenes consolidado por ÍTEM» y `consolidado`, el
 * «…por PARTIDA». Los valores del tipo quedaron con los nombres viejos a
 * propósito: renombrarlos tocaría los dos módulos de PDF sin cambiar nada de lo
 * que ve el usuario, y son nombres internos.
 */
export type TipoReporteStock = "detalle" | "consolidado"

/** En qué formato se emite. El contenido es el mismo en los dos. */
export type FormatoReporte = "pdf" | "excel"

export function useReporteStock() {
  const [generando, setGenerando] = useState(false)
  const { user } = useAuth()

  async function abrirReporte(
    tipo: TipoReporteStock,
    query: QueryStock,
    almacen: string | null,
    formato: FormatoReporte = "pdf"
  ) {
    // La pestaña se abre AHORA, dentro del gesto del clic: después de generar,
    // el navegador la bloquearía como emergente. El Excel NO abre pestaña: el
    // navegador no lo renderiza, así que se descarga.
    const ventana = formato === "pdf" ? window.open("", "_blank") : null
    setGenerando(true)
    try {
      // Los dos reportes salen del MISMO dato: el consolidado es una
      // reagrupación del detalle, así que siempre cuadran entre sí.
      const filas = await obtenerReporteStock(query)
      const datos = {
        filas,
        almacen,
        emitidoEn: new Date(),
        usuario: user?.nombre ?? "—",
      }

      if (formato === "excel") {
        const descargar =
          tipo === "consolidado"
            ? await import("@/features/stock/lib/estado-consolidado-excel").then(
                (m) => m.descargarEstadoConsolidadoExcel
              )
            : await import("@/features/stock/lib/estado-almacenes-excel").then(
                (m) => m.descargarEstadoAlmacenesExcel
              )
        await descargar(datos)
        return
      }

      const { crear, nombre } =
        tipo === "consolidado"
          ? await import("@/features/stock/lib/estado-consolidado-pdf").then(
              (m) => ({
                crear: m.crearEstadoConsolidadoPdf,
                nombre: m.nombreArchivoConsolidado,
              })
            )
          : await import("@/features/stock/lib/estado-almacenes-pdf").then(
              (m) => ({
                crear: m.crearEstadoAlmacenesPdf,
                nombre: m.nombreArchivoReporte,
              })
            )

      const pdf = await crear(datos)
      if (ventana) await pdf.open(ventana)
      else await pdf.download(nombre(datos))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar el reporte: ${error.message}`
          : "No se pudo generar el reporte de stock"
      )
    } finally {
      setGenerando(false)
    }
  }

  return { abrirReporte, generando }
}
