import { Link, Outlet, useLocation } from "react-router-dom"

import { AppSidebar } from "@/features/dashboard/components/AppSidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

/** Titulo de la seccion actual para el breadcrumb (se amplia con cada modulo). */
const SECCIONES: Record<string, string> = {
  unidades: "Unidades",
  almacenes: "Almacenes",
  usuarios: "Usuarios",
  partidas: "Partidas",
  items: "Ítems",
  proveedores: "Proveedores",
}

export const DashboardLayout = () => {
  const { pathname } = useLocation()
  const seccion = SECCIONES[pathname.split("/")[1] ?? ""]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/">Almacenes INIAF</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {seccion && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{seccion}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
