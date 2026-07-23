import { createBrowserRouter } from "react-router-dom"

import { LoginPage } from "@/features/auth/pages/LoginPage"
import { DashboardLayout } from "@/features/dashboard/layout/DashboardLayout"
import { DashboardHomePage } from "@/features/dashboard/pages/DashboardHomePage"
import { AlmacenesPage } from "@/features/almacenes/AlmacenesPage"
import { FuentesFinanciamientoPage } from "@/features/fuentes-financiamiento/FuentesFinanciamientoPage"
import { IngresoFormPage } from "@/features/ingresos/pages/IngresoFormPage"
import { IngresosPage } from "@/features/ingresos/pages/IngresosPage"
import { ItemsPage } from "@/features/items/ItemsPage"
import { PartidasPage } from "@/features/partidas/PartidasPage"
import { ProveedoresPage } from "@/features/proveedores/ProveedoresPage"
import { UnidadesPage } from "@/features/unidades/UnidadesPage"
import { UsuariosPage } from "@/features/usuarios/UsuariosPage"
import { ProtectedRoute, PublicOnlyRoute } from "@/routes/ProtectedRoute"

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: "/auth/login",
        element: <LoginPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardHomePage />,
          },
          {
            path: "unidades",
            element: <UnidadesPage />,
          },
          {
            path: "almacenes",
            element: <AlmacenesPage />,
          },
          {
            path: "usuarios",
            element: <UsuariosPage />,
          },
          {
            path: "partidas",
            element: <PartidasPage />,
          },
          {
            path: "items",
            element: <ItemsPage />,
          },
          {
            path: "proveedores",
            element: <ProveedoresPage />,
          },
          {
            path: "fuentes-financiamiento",
            element: <FuentesFinanciamientoPage />,
          },
          {
            path: "ingresos",
            element: <IngresosPage />,
          },
          {
            path: "ingresos/nuevo",
            element: <IngresoFormPage />,
          },
          {
            path: "ingresos/:id",
            element: <IngresoFormPage />,
          },
        ],
      },
    ],
  },
])
