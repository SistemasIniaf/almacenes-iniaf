import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Aclaración que acompaña a la foto de un ítem donde se la amplía (2026-10-20,
 * pedido del usuario). La foto es la del CATÁLOGO: muestra qué tipo de objeto
 * es, no lo que entró en una compra concreta — desde que se quitó la foto por
 * lote, un mismo ítem puede tener en el almacén otra marca, otro modelo u otro
 * color que el de la foto. Lo que distingue eso es la Observación de la línea.
 *
 * Un solo componente para que diga lo mismo en el ingreso, el egreso y el
 * catálogo.
 */
export function AvisoImagenReferencial({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="mt-px size-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">Imagen referencial.</strong> Muestra
        el tipo de objeto, no necesariamente la marca, el modelo ni el color del
        material que hay en el almacén.
      </span>
    </p>
  )
}
