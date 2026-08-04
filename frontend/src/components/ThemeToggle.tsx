import { Moon, Sun } from "lucide-react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { useTheme } from "@/components/theme-provider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Switch claro/oscuro de la cabecera. El atajo de teclado «d» ya hacía lo mismo,
 * pero no se descubre solo: nadie lo usa si no se lo cuentan.
 *
 * Va armado sobre el primitivo de Radix y no sobre `ui/switch.tsx`: de ese
 * componente habría que pisar el tamaño, los dos colores de estado, el pulgar y
 * el recorrido —o sea todo salvo el cableado—, y encima necesita meterle hijos
 * al riel, que el wrapper no acepta.
 *
 * **Los dos íconos están SIEMPRE dibujados**, sol a la izquierda y luna a la
 * derecha, y el pulgar tapa al del modo que no rige. De ahí que no haga falta
 * mostrarlos y esconderlos: es el mismo movimiento del pulgar el que descubre
 * uno y cubre el otro.
 *
 * **El riel va del color del texto** (`bg-foreground`), o sea el inverso de la
 * página: píldora oscura sobre fondo claro y clara sobre fondo oscuro. La
 * referencia que se tomó pintaba el riel del color del MODO —negro en oscuro—,
 * que en pantalla se confunde con el fondo de la cabecera: ese era justamente el
 * problema del switch anterior, que no se notaba.
 *
 * El estado sale de `resolvedTheme`, no de `theme`: este último puede valer
 * "system", que no es ni prendido ni apagado.
 */
export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const esOscuro = resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SwitchPrimitive.Root
          checked={esOscuro}
          onCheckedChange={toggleTheme}
          aria-label="Modo oscuro"
          className="relative flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full bg-foreground/90 transition-colors outline-none hover:bg-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Sun className="pointer-events-none absolute top-1/2 left-1.5 size-4 -translate-y-1/2 text-background" />
          <Moon className="pointer-events-none absolute top-1/2 right-1.5 size-4 -translate-y-1/2 text-background" />

          {/* Prendido = oscuro = pulgar a la IZQUIERDA, destapando la luna, como
              en la referencia. El sentido lo da el ícono que queda a la vista,
              no de qué lado cae el pulgar. */}
          <SwitchPrimitive.Thumb className="pointer-events-none relative z-10 size-6 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-[state=unchecked]:translate-x-[26px]" />
        </SwitchPrimitive.Root>
      </TooltipTrigger>
      <TooltipContent>
        {esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} (tecla «d»)
      </TooltipContent>
    </Tooltip>
  )
}
