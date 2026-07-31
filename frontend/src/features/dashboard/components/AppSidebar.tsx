import * as React from "react"
import { Link } from "react-router-dom"

import { NavMain } from "@/features/dashboard/components/NavMain"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              to="/"
              className="flex flex-col items-center gap-1.5 rounded-md p-2 transition-opacity hover:opacity-80"
            >
              {/* DOS archivos, uno por tema. El logo no se puede invertir ni
                  recolorear con CSS: el logotipo es gris oscuro y la llama lleva
                  los colores de la bandera. La institución provee su versión
                  para fondo oscuro (texto en blanco, llama igual), y se alterna
                  con `dark:` — la oculta queda en `display:none`, así que los
                  lectores de pantalla no leen el nombre dos veces.
                  `logo-iniaf.png` es el mismo archivo que va en los PDF. */}
              <img
                src="/iniaf/logo-iniaf.png"
                alt="INIAF — Instituto Nacional de Innovación Agropecuaria y Forestal"
                className="w-full max-w-40 dark:hidden"
              />
              <img
                src="/iniaf/dark.png"
                alt="INIAF — Instituto Nacional de Innovación Agropecuaria y Forestal"
                className="hidden w-full max-w-40 dark:block"
              />
              {/* Lo único que el logo NO dice: de qué sistema del INIAF se
                  trata. */}
              <span className="text-xs font-semibold tracking-widest text-sidebar-foreground/70">
                ALMACENES
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
    </Sidebar>
  )
}
