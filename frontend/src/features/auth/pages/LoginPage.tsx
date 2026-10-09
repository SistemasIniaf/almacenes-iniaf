import { ThemeToggle } from "@/components/ThemeToggle"

import { LoginForm } from "../components/LoginForm"

export const LoginPage = () => {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      {/* Arranca en oscuro por defecto (ver `main.tsx`): sin esto, a quien
          prefiere claro no le queda forma de cambiarlo antes de loguearse. */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  )
}
