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
 * Genera el reporte «Estado de almacenes» y lo abre en una pestaña con el visor
 * de PDF del navegador, igual que la nota de ingreso.
 */
export type TipoReporteStock = "detalle" | "consolidado"

export function useReporteStock() {
  const [generando, setGenerando] = useState(false)
  const { user } = useAuth()

  async function abrirReporte(
    tipo: TipoReporteStock,
    query: QueryStock,
    almacen: string
  ) {
    // La pestaña se abre AHORA, dentro del gesto del clic: después de generar,
    // el navegador la bloquearía como emergente.
    const ventana = window.open("", "_blank")
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
