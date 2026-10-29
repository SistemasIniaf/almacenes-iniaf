import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { InputField } from "@/components/form/InputField"
import {
  useActualizarClaveInicial,
  useClaveInicial,
} from "@/features/usuarios/useUsuarios"

// Espejo de `ClaveInicialDto`: la misma regla que cualquier contraseña.
const schema = z.object({
  claveInicial: z
    .string()
    .min(6, "La contraseña inicial debe tener al menos 6 caracteres"),
})
type Valores = z.infer<typeof schema>

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

interface ClaveInicialDialogProps {
  /** Solo el super_admin la cambia; el admin la ve para dársela a los usuarios nuevos. */
  puedeCambiar: boolean
  onClose: () => void
}

/**
 * La contraseña con la que nacen las cuentas nuevas (2026-10-29). Se monta solo
 * al abrirse, así el formulario arranca con el valor vigente sin un `reset` en
 * un efecto: se crea recién cuando la consulta ya respondió.
 */
export function ClaveInicialDialog({
  puedeCambiar,
  onClose,
}: ClaveInicialDialogProps) {
  const { data, isPending } = useClaveInicial()

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contraseña inicial</DialogTitle>
          <DialogDescription>
            Toda cuenta nueva nace con esta contraseña, y también vuelve a ella
            al usar «Restablecer contraseña». Cada usuario puede cambiarla
            después desde «Cambiar contraseña», en su menú.
          </DialogDescription>
        </DialogHeader>

        {data && (
          <p className="text-xs text-muted-foreground">
            Último cambio: {fecha(data.updatedAt)}
            {data.actualizadoPor ? ` · ${data.actualizadoPor.nombre}` : ""}
          </p>
        )}

        {isPending || !data ? (
          <Skeleton className="h-24 w-full" />
        ) : puedeCambiar ? (
          <FormularioClave valorActual={data.claveInicial} onClose={onClose} />
        ) : (
          <p className="rounded-md border bg-muted/30 p-3 text-center font-mono text-lg font-medium">
            {data.claveInicial}
          </p>
        )}

        {!puedeCambiar && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormularioClave({
  valorActual,
  onClose,
}: {
  valorActual: string
  onClose: () => void
}) {
  const actualizar = useActualizarClaveInicial()
  const { control, handleSubmit } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: { claveInicial: valorActual },
  })

  return (
    <form
      onSubmit={handleSubmit(async ({ claveInicial }) => {
        try {
          await actualizar.mutateAsync(claveInicial)
          onClose()
        } catch {
          // El toast lo emite la mutación.
        }
      })}
    >
      {/* Texto visible y SIN mayúsculas automáticas: hay que poder leerla
          para dársela al usuario, y se compara exacta al entrar. */}
      <InputField
        name="claveInicial"
        label="Contraseña inicial"
        control={control}
        autoComplete="off"
        mayusculas={false}
        disabled={actualizar.isPending}
        description="Cambiarla no afecta a las cuentas que ya la tienen pendiente: rige para las que se creen o restablezcan desde ahora."
      />
      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={actualizar.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={actualizar.isPending}>
          {actualizar.isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}
