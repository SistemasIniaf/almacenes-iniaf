import { useEffect, useState } from "react"

/**
 * Retrasa la propagacion de un valor. Se usa en los buscadores de los listados
 * para no disparar una peticion por cada tecla.
 */
export function useDebouncedValue<T>(valor: T, retrasoMs = 350): T {
  const [valorDiferido, setValorDiferido] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => setValorDiferido(valor), retrasoMs)
    return () => clearTimeout(timer)
  }, [valor, retrasoMs])

  return valorDiferido
}
