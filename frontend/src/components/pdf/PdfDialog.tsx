import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { PdfAbierto } from "@/hooks/use-visor-pdf"

interface PdfDialogProps extends PdfAbierto {
  /** Nombre del documento: «Nota de ingreso», «Solicitud de materiales». */
  titulo: string
  onClose: () => void
}

/**
 * Visor de PDF dentro de la aplicación, compartido por los documentos del
 * sistema (nota de ingreso y solicitud de materiales).
 *
 * Antes cada uno se abría en una pestaña nueva, lo que obligaba a llamar a
 * `window.open` dentro del gesto del clic para esquivar el bloqueador de
 * emergentes — y aun así algunos navegadores la bloqueaban y había que caer en
 * descargar el archivo. Con el PDF como object URL en un `<iframe>` no hay
 * pestaña que bloquear, y el usuario no pierde de vista el listado.
 *
 * El `<iframe>` usa el visor nativo del navegador, así que se lleva gratis el
 * zoom, las miniaturas, imprimir y descargar. El botón propio de descarga es el
 * salvavidas: algunos navegadores ocultan esa barra cuando el PDF va embebido.
 */
export function PdfDialog({
  titulo,
  url,
  nombre,
  etiqueta,
  onClose,
}: PdfDialogProps) {
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex h-[90vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{etiqueta}</DialogDescription>
        </DialogHeader>

        <iframe
          src={url}
          title={`${titulo} ${etiqueta}`}
          className="min-h-0 w-full flex-1 rounded-md border bg-muted"
        />

        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={url} download={nombre}>
              <Download className="size-4" />
              Descargar
            </a>
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
