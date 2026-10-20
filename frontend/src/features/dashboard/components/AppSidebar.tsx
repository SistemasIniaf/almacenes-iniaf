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
import { useLogos } from "@/lib/logos"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const logos = useLogos()

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
                  El claro es el mismo que va en los PDF. Los dos son los
                  VIGENTES, que se cambian en «Logos». */}
              {logos.listo && (
                <>
                  <img
                    src={logos.url("INIAF")}
                    alt="INIAF — Instituto Nacional de Innovación Agropecuaria y Forestal"
                    className="max-h-20 w-full max-w-40 object-contain dark:hidden"
                  />
                  <img
                    src={logos.url("INIAF_OSCURO")}
                    alt="INIAF — Instituto Nacional de Innovación Agropecuaria y Forestal"
                    className="hidden max-h-20 w-full max-w-40 object-contain dark:block"
                  />
                </>
              )}
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
