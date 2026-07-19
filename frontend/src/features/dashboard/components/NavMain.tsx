import {
  Building2,
  LayoutDashboard,
  ListTree,
  Package,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"
import { NavLink } from "react-router-dom"

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

  const visibles = ITEMS.filter(
    (item) => !item.permiso || tienePermiso(user, item.permiso)
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Administración</SidebarGroupLabel>
      <SidebarMenu>
        {visibles.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild tooltip={item.titulo}>
              {/* `end` en "/" para que el inicio no quede activo en toda ruta hija. */}
              <NavLink to={item.url} end={item.url === "/"}>
                {({ isActive }) => (
                  <>
                    <item.icono />
                    <span className={isActive ? "font-medium" : undefined}>
                      {item.titulo}
                    </span>
                  </>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
