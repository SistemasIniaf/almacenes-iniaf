import { createBrowserRouter } from "react-router-dom"

import { LoginPage } from "@/features/auth/pages/LoginPage"
import { DashboardLayout } from "@/features/dashboard/layout/DashboardLayout"
import { DashboardHomePage } from "@/features/dashboard/pages/DashboardHomePage"

export const router = createBrowserRouter([
  {
    path: "/auth/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardHomePage />,
      },
    ],
  },
])
