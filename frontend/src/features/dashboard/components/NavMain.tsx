import {
  Building2,
  LayoutDashboard,
  ListTree,
  Package,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"

import type { LucideIcon } from "lucide-react"
import type { Permiso } from "@/features/auth/lib/permisos"

interface ItemMenu {
  titulo: string
  url: string
  icono: LucideIcon
  /** Sin permiso, el item ni se renderiza. `undefined` = visible para todos. */
  permiso?: Permiso
}

/**
 * Estado activo con el color primario del tema (más notorio que el
 * `bg-sidebar-accent` tenue que trae `SidebarMenuButton` por defecto). Se usa la
 * variante `data-[active=true]:` porque ese selector gana en especificidad al
 * estilo base del componente.
 */
const CLASE_ACTIVO =
  "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90 data-[active=true]:hover:text-primary-foreground"

/**
 * Menu real del sistema. Se agregan entradas a medida que se construye cada
 * feature — NO listar modulos sin ruta todavia (quedarian como enlaces muertos).
 * Pendientes: stock, ingresos, egresos, kardex y reportes (dependen de reglas
 * de negocio todavia sin confirmar — ver CLAUDE.md).
 */
const ITEMS: ItemMenu[] = [
  { titulo: "Inicio", url: "/", icono: LayoutDashboard },
  {
    titulo: "Unidades",
    url: "/unidades",
    icono: Building2,
    permiso: "unidadesLeer",
  },
  {
    titulo: "Almacenes",
    url: "/almacenes",
    icono: Warehouse,
    permiso: "almacenesLeer",
  },
  {
    titulo: "Usuarios",
    url: "/usuarios",
    icono: Users,
    permiso: "usuariosLeer",
  },
  {
    titulo: "Partidas",
    url: "/partidas",
    icono: ListTree,
    permiso: "partidasLeer",
  },
  {
    titulo: "Ítems",
    url: "/items",
    icono: Package,
    permiso: "itemsLeer",
  },
  {
    titulo: "Proveedores",
    url: "/proveedores",
    icono: Truck,
    permiso: "proveedoresLeer",
  },
]

export function NavMain() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const visibles = ITEMS.filter(
    (item) => !item.permiso || tienePermiso(user, item.permiso)
  )

  /**
   * Inicio ("/") solo está activo en la raíz exacta; el resto también cuando la
   * ruta actual es una subruta suya (ej. /items/algo). El `isActive` se calcula
   * acá y se pasa a `SidebarMenuButton` para que pinte el ítem entero (fondo),
   * no solo el texto.
   */
  function estaActivo(url: string): boolean {
    if (url === "/") return pathname === "/"
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Administración</SidebarGroupLabel>
      <SidebarMenu>
        {visibles.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              asChild
              isActive={estaActivo(item.url)}
              tooltip={item.titulo}
              className={CLASE_ACTIVO}
            >
              <Link to={item.url}>
                <item.icono />
                <span>{item.titulo}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
