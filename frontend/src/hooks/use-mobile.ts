import * as React from "react"

const MOBILE_BREAKPOINT = 768
const CONSULTA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// useSyncExternalStore y no useState + efecto: el lint del repo rechaza setState
// dentro de useEffect, y así el valor ya está bien en el primer render.
function suscribir(aviso: () => void) {
  const mql = window.matchMedia(CONSULTA)
  mql.addEventListener("change", aviso)
  return () => mql.removeEventListener("change", aviso)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  )
}
