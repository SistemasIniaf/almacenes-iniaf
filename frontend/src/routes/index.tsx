import { createBrowserRouter } from "react-router-dom"

import { LoginPage } from "@/features/auth/pages/LoginPage"
import { DashboardLayout } from "@/features/dashboard/layout/DashboardLayout"
import { DashboardHomePage } from "@/features/dashboard/pages/DashboardHomePage"
import { AlmacenesPage } from "@/features/almacenes/AlmacenesPage"
import { EgresoFormPage } from "@/features/egresos/pages/EgresoFormPage"
import { EgresosPage } from "@/features/egresos/pages/EgresosPage"
import { FuentesFinanciamientoPage } from "@/features/fuentes-financiamiento/FuentesFinanciamientoPage"
import { IngresoFormPage } from "@/features/ingresos/pages/IngresoFormPage"
import { IngresosPage } from "@/features/ingresos/pages/IngresosPage"
import { ItemsPage } from "@/features/items/ItemsPage"
import { KardexPage } from "@/features/kardex/KardexPage"
import { PartidasPage } from "@/features/partidas/PartidasPage"
import { ProveedoresPage } from "@/features/proveedores/ProveedoresPage"
import { StockPage } from "@/features/stock/StockPage"
import { UnidadesPage } from "@/features/unidades/UnidadesPage"
import { UsuariosPage } from "@/features/usuarios/UsuariosPage"
import { ProtectedRoute, PublicOnlyRoute } from "@/routes/ProtectedRoute"
import { RutaConPermiso } from "@/routes/RutaConPermiso"

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
          // Cada ruta lleva el MISMO permiso con el que el menú decide mostrar
          // su ítem (ver `GRUPOS` en NavMain): si no, una URL escrita a mano o
          // un favorito viejo abren una pantalla que carga entera y solo
          // devuelve 403. No es una barrera —esa es el backend— sino no mentirle
          // al usuario sobre lo que puede abrir.
          {
            path: "unidades",
            element: (
              <RutaConPermiso permiso="unidadesLeer">
                <UnidadesPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "almacenes",
            element: (
              <RutaConPermiso permiso="almacenesLeer">
                <AlmacenesPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "usuarios",
            element: (
              <RutaConPermiso permiso="usuariosLeer">
                <UsuariosPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "partidas",
            element: (
              <RutaConPermiso permiso="partidasLeer">
                <PartidasPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "items",
            element: (
              <RutaConPermiso permiso="itemsLeer">
                <ItemsPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "proveedores",
            element: (
              <RutaConPermiso permiso="proveedoresLeer">
                <ProveedoresPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "fuentes-financiamiento",
            element: (
              <RutaConPermiso permiso="fuentesLeer">
                <FuentesFinanciamientoPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "stock",
            element: (
              <RutaConPermiso permiso="stockLeer">
                <StockPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "kardex",
            element: (
              <RutaConPermiso permiso="kardexLeer">
                <KardexPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "ingresos",
            element: (
              <RutaConPermiso permiso="ingresosLeer">
                <IngresosPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "ingresos/nuevo",
            element: (
              <RutaConPermiso permiso="ingresosEscribir">
                <IngresoFormPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "ingresos/:id",
            element: (
              <RutaConPermiso permiso="ingresosLeer">
                <IngresoFormPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "egresos",
            element: (
              <RutaConPermiso permiso="egresosLeer">
                <EgresosPage />
              </RutaConPermiso>
            ),
          },
          {
            // Crear un pedido es solo del solicitador; ver uno, de todo el
            // circuito. Por eso la ruta `nuevo` va con otro permiso que `:id`.
            path: "egresos/nuevo",
            element: (
              <RutaConPermiso permiso="egresosCrear">
                <EgresoFormPage />
              </RutaConPermiso>
            ),
          },
          {
            path: "egresos/:id",
            element: (
              <RutaConPermiso permiso="egresosLeer">
                <EgresoFormPage />
              </RutaConPermiso>
            ),
          },
        ],
      },
    ],
  },
])
