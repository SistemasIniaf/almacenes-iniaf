import { Link } from "react-router-dom"
import { ShieldOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"

import type { ReactNode } from "react"
import type { Permiso } from "@/features/auth/lib/permisos"

/**
 * Acota una ruta privada a quienes tienen un permiso.
 *
 * **No es una barrera de seguridad** —quien autoriza es el backend, y cada
 * endpoint responde 403 por su cuenta—: es para que una URL escrita a mano, un
 * favorito viejo o un enlace pegado en un chat no terminen en una pantalla que
 * carga entera y solo devuelve errores. El menú ya oculta lo que cada rol no
 * puede abrir; esto cierra el mismo hueco cuando no se llega por el menú.
 *
 * Muestra un aviso en vez de redirigir en silencio: mandar al inicio sin decir
 * nada se lee como que el enlace está roto, y quien lo pegó no se entera de que
 * el problema es de permisos.
 */
export function RutaConPermiso({
  permiso,
  children,
}: {
  permiso: Permiso
  children: ReactNode
}) {
  const { user } = useAuth()

  if (tienePermiso(user, permiso)) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ShieldOff className="size-10 text-muted-foreground/60" />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          No tenés acceso a esta sección
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu rol no la incluye. Si creés que deberías verla, hablá con el
          administrador del sistema.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
