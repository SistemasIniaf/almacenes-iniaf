/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  /**
   * El tema que REALMENTE rige: igual que `theme`, salvo cuando vale "system",
   * donde resuelve al del sistema operativo. Es lo que necesita cualquier UI
   * que tenga que dibujarse segun el modo actual (el switch de la cabecera).
   */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Alterna claro/oscuro. Desde "system" salta al contrario del que rige. */
  toggleTheme: () => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

/**
 * El tema del sistema, leido como fuente externa. Va con `useSyncExternalStore`
 * y no con un `useState` + efecto porque el lint del repo (reglas del React
 * Compiler) rechaza `setState` dentro de `useEffect`, y porque asi el valor ya
 * esta disponible en el PRIMER render, sin un frame con el dato viejo.
 * `getSystemTheme` devuelve un string, o sea que la comparacion por identidad
 * que hace React no puede lazar un bucle de renders.
 */
function subscribeSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
  mediaQuery.addEventListener("change", onChange)

  return () => {
    mediaQuery.removeEventListener("change", onChange)
  }
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  if (editableParent) {
    return true
  }

  return false
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }

    return defaultTheme
  })

  const systemTheme = React.useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme
  )

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? systemTheme : theme

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  /**
   * Lo comparten el switch de la cabecera (`ThemeToggle`) y el atajo de teclado
   * «d». Vive aca y no en cada uno porque la parte que se olvida al duplicarla
   * es el caso "system": desde ahi hay que saltar al CONTRARIO del que rige,
   * no a un valor fijo. Al alternar, el tema deja de ser "system": elegir a mano
   * es justamente decir que no se siga al sistema operativo.
   */
  const toggleTheme = React.useCallback(() => {
    const nextTheme: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark"

    localStorage.setItem(storageKey, nextTheme)
    setThemeState(nextTheme)
  }, [resolvedTheme, storageKey])

  const applyTheme = React.useCallback(
    (nextTheme: ResolvedTheme) => {
      const root = document.documentElement
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(nextTheme)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  // Un solo efecto: `resolvedTheme` ya cambia solo cuando el sistema cambia de
  // modo (lo sigue `useSyncExternalStore`), asi que aca no hace falta repetir la
  // suscripcion al `matchMedia` como antes.
  React.useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme, applyTheme])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      toggleTheme()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleTheme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }

      setThemeState(defaultTheme)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
