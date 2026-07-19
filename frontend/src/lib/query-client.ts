import { QueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // No reintentar errores del cliente (401/403/404): reintentar no los arregla
      // y el 401 ya lo maneja el interceptor de refresh.
      retry: (fallos, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined
        if (status && status >= 400 && status < 500) return false
        return fallos < 2
      },
    },
    mutations: { retry: false },
  },
})
