import { useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { textoCredenciales } from "@/features/usuarios/credenciales"
import { obtenerCredenciales } from "@/features/usuarios/usuarios.api"
import { getApiErrorMessage } from "@/lib/api"
import { copiarTexto } from "@/lib/portapapeles"

import type { Usuario } from "@/features/usuarios/usuarios.types"

/**
 * Ícono junto al nombre de usuario en la tabla: copia sus datos de acceso para
 * mandarlos por WhatsApp o correo (2026-10-29, pedido del usuario).
 *
 * La contraseña se pide AL HACER CLIC y la decide el backend, que la compara
 * contra el hash: va solo si la cuenta todavía tiene la inicial vigente. Si ya
 * la cambió, se copian enlace y usuario sin ella y se avisa — para darle una de
 * nuevo está «Restablecer contraseña».
 */
export function CopiarCredenciales({ usuario }: { usuario: Usuario }) {
  const [estado, setEstado] = useState<"quieto" | "copiando" | "copiado">(
    "quieto"
  )

  async function copiar() {
    setEstado("copiando")
    try {
      const datos = await obtenerCredenciales(usuario.id)
      const ok = await copiarTexto(
        textoCredenciales(datos.usuario, datos.claveInicial)
      )
      if (!ok) {
        toast.error("No se pudo copiar al portapapeles.")
        setEstado("quieto")
        return
      }
      if (datos.claveInicial) {
        toast.success(`Datos de acceso de «${datos.usuario}» copiados`)
      } else {
        toast.info(
          `Copiado sin contraseña: «${datos.usuario}» ya eligió la suya. Si la olvidó, restablecela.`
        )
      }
      setEstado("copiado")
      setTimeout(() => setEstado("quieto"), 1500)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
      setEstado("quieto")
    }
  }

  const Icono =
    estado === "copiando" ? Loader2 : estado === "copiado" ? Check : Copy

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      disabled={estado === "copiando"}
      title="Copiar datos de acceso"
      aria-label={`Copiar datos de acceso de ${usuario.usuario}`}
      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <Icono
        className={
          estado === "copiando"
            ? "size-3.5 animate-spin"
            : estado === "copiado"
              ? "size-3.5 text-primary"
              : "size-3.5"
        }
      />
    </button>
  )
}
