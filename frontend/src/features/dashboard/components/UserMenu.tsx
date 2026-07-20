import { ChevronDown, LogOut } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { ROL_LABEL } from "@/features/auth/lib/auth.types"

/** Iniciales para el avatar (no hay fotos de usuario en el sistema). */
function iniciales(texto: string): string {
  return texto
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase())
    .join("")
}

/**
 * Menú de usuario de la cabecera (arriba a la derecha). Reemplaza al NavUser que
 * antes vivía en el pie de la barra lateral.
 */
export function UserMenu() {
  const { user, logout } = useAuth()

  if (!user) return null

  // `nombre` solo llega en el login; tras recargar puede no estar (ver auth-storage).
  const displayName = user.nombre ?? user.usuario
  const rol = ROL_LABEL[user.rol]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-1.5 sm:px-2"
          aria-label="Menú de usuario"
        >
          <Avatar className="size-7 rounded-lg">
            <AvatarFallback className="rounded-lg text-xs">
              {iniciales(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
            {displayName}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex flex-col px-1 py-1.5">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              @{user.usuario} · {rol}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Sin navigate: al caer `autenticado`, ProtectedRoute manda al login. */}
        <DropdownMenuItem onSelect={logout}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
