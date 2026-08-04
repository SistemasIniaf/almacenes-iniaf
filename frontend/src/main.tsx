import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"

import "./index.css"
import { router } from "./routes"
import { queryClient } from "@/lib/query-client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/context/AuthProvider"

import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Oscuro por defecto (pedido del usuario). Solo rige para quien nunca
        eligió: si ya hay tema guardado en localStorage, manda ese. */}
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        {/* AuthProvider envuelve al router (no al reves): las rutas dependen de la sesion. */}
        <AuthProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            {/* Centrado arriba: el sistema se usa en pantallas anchas y en la
                esquina derecha el aviso caía lejos de donde estaba la vista. */}
            <Toaster position="top-center" richColors />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
