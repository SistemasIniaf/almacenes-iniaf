import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { useLocation, useNavigate } from "react-router-dom"
import { loginSchema } from "../lib/login.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field"

import { InputField } from "@/components/form/InputField"
import { InputPasswordField } from "@/components/form/InputPasswordField"
import { useLogin } from "../hooks/useLogin"
import type { LoginFormOutput } from "../lib/login.schema"

interface LocationState {
  from?: { pathname: string }
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const location = useLocation()
  const { mutateAsync, isPending, mensajeError } = useLogin()

  const { control, handleSubmit } = useForm<LoginFormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usuario: "",
      password: "",
    },
  })

  async function onSubmit(data: LoginFormOutput) {
    try {
      await mutateAsync(data)
      // Vuelve a la ruta que se intento abrir sin sesion, o al inicio.
      const destino = (location.state as LocationState | null)?.from?.pathname
      navigate(destino ?? "/", { replace: true })
    } catch {
      // El mensaje ya queda en `mensajeError`; no hay nada mas que hacer aqui.
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-extrabold">INIAF - ALMACENES</h1>
                <p className="text-balance text-muted-foreground">
                  Inicia sesión con tu cuenta.
                </p>
              </div>

              {mensajeError && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {mensajeError}
                </div>
              )}

              <InputField
                name="usuario"
                label="Usuario"
                control={control}
                autoComplete="username"
                disabled={isPending}
              />

              <InputPasswordField
                name="password"
                label="Contraseña"
                control={control}
                disabled={isPending}
              />

              <Field className="mt-4">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isPending ? "Ingresando..." : "Iniciar sesión"}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Sistema de gestión de almacén
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative hidden bg-muted md:block">
            <img
              src="/iniaf/banner.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
