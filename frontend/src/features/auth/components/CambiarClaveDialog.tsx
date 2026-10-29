import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { InputPasswordField } from "@/components/form/InputPasswordField"
import { cambiarClave } from "@/features/auth/api/auth.api"
import { cambiarClaveSchema } from "@/features/auth/lib/cambiar-clave.schema"
import { getApiErrorMessage } from "@/lib/api"

import type { CambiarClaveValues } from "@/features/auth/lib/cambiar-clave.schema"

interface CambiarClaveDialogProps {
  onClose: () => void
}

/**
 * Cada usuario cambia su propia contraseña (2026-10-29), desde el menú de
 * usuario. Se monta solo al abrirse: así cada apertura arranca con el
 * formulario vacío, sin un `reset` en un efecto.
 *
 * La sesión sigue abierta después del cambio: no hace falta volver a entrar.
 */
export function CambiarClaveDialog({ onClose }: CambiarClaveDialogProps) {
  const { control, handleSubmit } = useForm<CambiarClaveValues>({
    resolver: zodResolver(cambiarClaveSchema),
    defaultValues: { actual: "", nueva: "", confirmacion: "" },
  })

  const cambiar = useMutation({
    mutationFn: cambiarClave,
    onSuccess: () => {
      toast.success("Contraseña cambiada")
      onClose()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Para confirmar que sos vos, ingresá primero la contraseña actual.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(({ actual, nueva }) =>
            cambiar.mutate({ actual, nueva })
          )}
        >
          <FieldGroup>
            <InputPasswordField
              name="actual"
              label="Contraseña actual"
              control={control}
              autoComplete="current-password"
              disabled={cambiar.isPending}
            />
            <InputPasswordField
              name="nueva"
              label="Contraseña nueva"
              control={control}
              autoComplete="new-password"
              description="Al menos 6 caracteres."
              disabled={cambiar.isPending}
            />
            <InputPasswordField
              name="confirmacion"
              label="Repetí la contraseña nueva"
              control={control}
              autoComplete="new-password"
              disabled={cambiar.isPending}
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={cambiar.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={cambiar.isPending}>
              {cambiar.isPending && <Loader2 className="size-4 animate-spin" />}
              Cambiar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
