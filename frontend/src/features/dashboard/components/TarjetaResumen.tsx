import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import type { LucideIcon } from "lucide-react"

interface TarjetaResumenProps {
  titulo: string
  valor: number | undefined
  cargando: boolean
  /** Qué significa el número, en una línea. */
  detalle: string
  /** A dónde lleva la tarjeta entera (es un enlace). */
  a: string
  icono: LucideIcon
  /**
   * `true` en la tarjeta que exige una acción de este usuario. Solo se resalta
   * si además hay algo que hacer: en cero es una tarjeta más y teñirla sería
   * pedir atención por nada.
   */
  urgente?: boolean
}

export function TarjetaResumen({
  titulo,
  valor,
  cargando,
  detalle,
  a,
  icono: Icono,
  urgente = false,
}: TarjetaResumenProps) {
  const resaltar = urgente && (valor ?? 0) > 0

  return (
    <Card
      className={cn(
        "gap-3 transition-colors hover:bg-muted/40",
        resaltar && "border-amber-300 dark:border-amber-900"
      )}
    >
      <Link to={a} className="contents">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          <Icono
            className={cn(
              "size-4 text-muted-foreground",
              resaltar && "text-amber-600 dark:text-amber-500"
            )}
          />
        </CardHeader>
        <CardContent>
          {cargando ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-3xl font-semibold tabular-nums">
              {valor ?? "—"}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
        </CardContent>
      </Link>
    </Card>
  )
}
