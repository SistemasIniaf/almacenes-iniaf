import { useEffect, useEffectEvent, useState } from "react"
import { toast } from "sonner"

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
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  AVISO_INACTIVIDAD_MS,
  MINUTOS_INACTIVIDAD,
  marcarActividad,
  restanteInactividad,
} from "@/lib/inactividad"
import { getAccessToken } from "@/lib/token-storage"

/** Lo que cuenta como «está usando el sistema». */
const EVENTOS_ACTIVIDAD = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const

/**
 * Escribir en localStorage en cada movimiento del mouse sería cientos de
 * escrituras por segundo para nada: la marca se renueva como mucho cada 15 s.
 */
const CADA_CUANTO_MARCAR_MS = 15 * 1000

/**
 * Vigila la inactividad y cierra la sesión a los 30 minutos (ver
 * `lib/inactividad.ts`). Un minuto antes avisa con una cuenta regresiva y un
 * botón para seguir: cerrar sin aviso a alguien que estaba leyendo un reporte
 * largo le haría perder lo que tenía a medio cargar.
 *
 * Va montado en el layout de las pantallas privadas, así solo corre con sesión.
 */
export function CierreInactividad() {
  const { logout } = useAuth()
  /** `null` = lejos del cierre, sin aviso. Si no, los segundos que faltan. */
  const [segundos, setSegundos] = useState<number | null>(null)

  const revisar = useEffectEvent(() => {
    // Otra pestaña cerró la sesión (a mano o por inactividad): los tokens ya no
    // están, así que esta no tiene que quedarse mostrando pantallas.
    if (!getAccessToken()) {
      logout()
      return
    }
    const restante = restanteInactividad()
    if (restante <= 0) {
      logout()
      toast.info(
        `Se cerró la sesión tras ${MINUTOS_INACTIVIDAD} minutos sin actividad.`
      )
      return
    }
    setSegundos(
      restante <= AVISO_INACTIVIDAD_MS ? Math.ceil(restante / 1000) : null
    )
  })

  useEffect(() => {
    let ultimaMarca = 0
    function alActuar() {
      const ahora = Date.now()
      if (ahora - ultimaMarca < CADA_CUANTO_MARCAR_MS) return
      ultimaMarca = ahora
      marcarActividad()
    }

    // Sin revisión inicial: la pestaña restaurada horas después la cierra ya
    // `AuthProvider` al rehidratar, antes de mostrar nada.
    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, alActuar, { passive: true })
    }
    const intervalo = window.setInterval(revisar, 1000)
    return () => {
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alActuar)
      }
      window.clearInterval(intervalo)
    }
  }, [])

  function seguir() {
    marcarActividad()
    setSegundos(null)
  }

  return (
    <AlertDialog open={segundos !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Seguís ahí?</AlertDialogTitle>
          <AlertDialogDescription>
            Por inactividad, la sesión se va a cerrar en{" "}
            <strong className="text-foreground tabular-nums">
              {segundos} s
            </strong>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={logout}>Cerrar sesión</AlertDialogCancel>
          <AlertDialogAction onClick={seguir}>
            Seguir conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
