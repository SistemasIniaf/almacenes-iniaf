import { Navigate, Outlet, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/useAuth"

/** Pantalla neutra mientras se resuelve si hay sesion valida. */
function PantallaCargando() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Cargando sesion...</span>
    </div>
  )
}

/** Envuelve las rutas privadas: sin sesion, manda al login. */
export function ProtectedRoute() {
  const { autenticado, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCargando />

  if (!autenticado) {
    // `from` permite volver a la ruta pedida despues de loguearse.
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/** Inversa: el login no debe verse si ya hay sesion abierta. */
export function PublicOnlyRoute() {
  const { autenticado, cargando } = useAuth()

  if (cargando) return <PantallaCargando />
  if (autenticado) return <Navigate to="/" replace />

  return <Outlet />
}
