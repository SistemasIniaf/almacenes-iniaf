import { useState } from "react"
import { Check, Copy } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { textoCredenciales } from "@/features/usuarios/credenciales"
import { useClaveInicial } from "@/features/usuarios/useUsuarios"
import { copiarTexto } from "@/lib/portapapeles"

interface CredencialesDialogProps {
  /** El usuario recién creado o restablecido: su contraseña ES la inicial. */
  usuario: string
  /** Para el título: no es lo mismo una cuenta nueva que una restablecida. */
  motivo: "creado" | "restablecido"
  onClose: () => void
}

/**
 * Los datos de acceso listos para pegar en WhatsApp o un correo (2026-10-29,
 * pedido del usuario), así nadie los tipea a mano.
 *
 * Solo se ofrece justo DESPUÉS de crear o restablecer: es el único momento en
 * que se sabe con certeza que la contraseña de la cuenta es la inicial vigente.
 * Más tarde podría haberla cambiado el usuario, o el super_admin haber cambiado
 * la inicial. Para cualquier otro usuario, en cualquier momento, está el ícono
 * de copiar junto a su nombre en la tabla (`CopiarCredenciales`).
 */
export function CredencialesDialog({
  usuario,
  motivo,
  onClose,
}: CredencialesDialogProps) {
  const { data } = useClaveInicial()
  const [copiado, setCopiado] = useState(false)

  const texto = data ? textoCredenciales(usuario, data.claveInicial) : null

  async function copiar() {
    if (!texto) return
    if (await copiarTexto(texto)) {
      setCopiado(true)
      toast.success("Datos de acceso copiados")
    } else {
      toast.error("No se pudo copiar: seleccioná el texto y copialo a mano.")
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {motivo === "creado" ? "Usuario creado" : "Contraseña restablecida"}
          </DialogTitle>
          <DialogDescription>
            Copiá los datos de acceso para mandárselos por WhatsApp o correo.
          </DialogDescription>
        </DialogHeader>

        {texto ? (
          // `select-all`: un clic selecciona todo, por si hay que copiarlo a mano.
          <pre className="rounded-md border bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap select-all">
            {texto}
          </pre>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => void copiar()} disabled={!texto}>
            {copiado ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
