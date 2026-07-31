import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Boxes,
  Building2,
  Landmark,
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

interface GrupoMenu {
  /** Sin título, el grupo va suelto y sin encabezado (el caso de «Inicio»). */
  titulo?: string
  items: ItemMenu[]
}

/**
 * Menu real del sistema, agrupado por lo que la gente viene a HACER, no por
 * cómo está armado el sistema. Antes todo colgaba de un único «Administración»,
 * lo que además era falso: registrar un ingreso o pedir material es la tarea
 * diaria del almacén, no una tarea administrativa.
 *
 * «Administración» va primero por pedido del usuario: quien la ve es admin o
 * super_admin, y para ellos es su tarea principal. Al resto de los roles el
 * grupo ni se les dibuja, así que no les mete distancia hasta lo suyo. Dentro,
 * el orden es usuarios → unidades → almacenes.
 *
 * El resto sigue el uso: se mueve material todos los días, se consulta seguido
 * y se toca un catálogo de vez en cuando.
 *
 * Un grupo cuyos ítems no pasan el filtro de permisos NO se dibuja: el
 * solicitante, por ejemplo, no ve encabezados vacíos de secciones que no puede
 * abrir. NO listar módulos sin ruta todavía: quedarían como enlaces muertos.
 */
const GRUPOS: GrupoMenu[] = [
  { items: [{ titulo: "Inicio", url: "/", icono: LayoutDashboard }] },
  {
    titulo: "Administración",
    items: [
      {
        titulo: "Usuarios",
        url: "/usuarios",
        icono: Users,
        permiso: "usuariosLeer",
      },
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
    ],
  },
  {
    titulo: "Movimientos",
    items: [
      {
        titulo: "Ingresos",
        url: "/ingresos",
        icono: ArrowDownToLine,
        permiso: "ingresosLeer",
      },
      {
        titulo: "Egresos",
        url: "/egresos",
        icono: ArrowUpFromLine,
        permiso: "egresosLeer",
      },
    ],
  },
  {
    titulo: "Consultas",
    items: [
      { titulo: "Stock", url: "/stock", icono: Boxes, permiso: "stockLeer" },
      {
        titulo: "Kardex",
        url: "/kardex",
        icono: BookOpen,
        permiso: "kardexLeer",
      },
    ],
  },
  {
    titulo: "Catálogos",
    items: [
      { titulo: "Ítems", url: "/items", icono: Package, permiso: "itemsLeer" },
      {
        titulo: "Partidas",
        url: "/partidas",
        icono: ListTree,
        permiso: "partidasLeer",
      },
      {
        titulo: "Proveedores",
        url: "/proveedores",
        icono: Truck,
        permiso: "proveedoresLeer",
      },
      {
        titulo: "Fuentes de financiamiento",
        url: "/fuentes-financiamiento",
        icono: Landmark,
        permiso: "fuentesLeer",
      },
    ],
  },
]

export function NavMain() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  // Se filtran los ítems y recién después se descartan los grupos que quedaron
  // sin ninguno: si no, un rol vería el encabezado de una sección vacía.
  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter(
      (item) => !item.permiso || tienePermiso(user, item.permiso)
    ),
  })).filter((grupo) => grupo.items.length > 0)

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
    <>
      {grupos.map((grupo, indice) => (
        <SidebarGroup key={grupo.titulo ?? `grupo-${indice}`}>
          {grupo.titulo && (
            <SidebarGroupLabel>{grupo.titulo}</SidebarGroupLabel>
          )}
          <SidebarMenu>
            {grupo.items.map((item) => (
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
      ))}
    </>
  )
}
