import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  History,
  ImagePlus,
  Loader2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { IconAction } from "@/components/data/IconAction"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useEliminarVersion,
  useHistorialLogos,
  useReemplazarLogo,
  useRestaurarLogo,
  useUsarVersion,
} from "@/features/logos/useLogosAdmin"
import { MIME_IMAGEN_PERMITIDOS, urlArchivo, validarImagen } from "@/lib/files"
import { logosQueryOptions, urlLogo } from "@/lib/logos"
import { cn } from "@/lib/utils"

import type { LogoVersion } from "@/features/logos/logos.api"
import type { LogoClave, LogosVigentes } from "@/lib/logos"

interface Casillero {
  clave: LogoClave
  titulo: string
  /** Dónde se ve: es lo que decide si el reemplazo es el correcto. */
  usos: string
  /** El fondo sobre el que se va a ver, para juzgarlo antes de que salga. */
  fondo: "claro" | "oscuro"
}

const CASILLEROS: Casillero[] = [
  {
    clave: "INIAF",
    titulo: "INIAF",
    usos: "Login y menú lateral en modo claro, y el membrete de todos los PDF y Excel.",
    fondo: "claro",
  },
  {
    clave: "INIAF_OSCURO",
    titulo: "INIAF (fondo oscuro)",
    usos: "Login y menú lateral en modo oscuro. Conviene con el texto en blanco.",
    fondo: "oscuro",
  },
  {
    clave: "MINISTERIO",
    titulo: "Ministerio",
    usos: "Membrete de todos los PDF y Excel, a la derecha.",
    fondo: "claro",
  },
]

/**
 * Fondo FIJO, no el del tema: muestra el logo como va a salir (blanco como el
 * papel, u oscuro como el menú en modo oscuro), sea cual sea el tema de quien
 * lo está cambiando.
 */
const FONDO = { claro: "bg-white", oscuro: "bg-neutral-900" } as const

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function LogosPage() {
  const { data, isPending } = useQuery(logosQueryOptions)
  const historial = useHistorialLogos()
  const reemplazar = useReemplazarLogo()
  const restaurar = useRestaurarLogo()
  const usar = useUsarVersion()
  const eliminar = useEliminarVersion()
  const [aRestaurar, setARestaurar] = useState<Casillero | null>(null)
  const [aEliminar, setAEliminar] = useState<LogoVersion | null>(null)

  const ocupado =
    reemplazar.isPending ||
    restaurar.isPending ||
    usar.isPending ||
    eliminar.isPending

  async function confirmarRestauracion() {
    if (!aRestaurar) return
    try {
      await restaurar.mutateAsync(aRestaurar.clave)
      setARestaurar(null)
    } catch {
      // El toast de error ya lo muestra el hook.
    }
  }

  async function confirmarEliminacion() {
    if (!aEliminar) return
    try {
      await eliminar.mutateAsync(aEliminar.id)
      setAEliminar(null)
    } catch {
      // El toast de error ya lo muestra el hook.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logos</h1>
        <p className="text-sm text-muted-foreground">
          Los logos institucionales del sistema. Al reemplazar uno cambia en
          todos lados a la vez: pantallas y documentos que se emitan desde ahora
          (los ya impresos no cambian). El anterior queda en el historial por si
          hay que volver a él. Usá PNG con fondo transparente.
        </p>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-3">
        {CASILLEROS.map((casillero) => (
          <TarjetaLogo
            key={casillero.clave}
            casillero={casillero}
            logos={data}
            cargando={isPending}
            versiones={(historial.data ?? []).filter(
              (v) => v.clave === casillero.clave && !v.vigente
            )}
            cargandoHistorial={historial.isPending}
            subiendo={
              reemplazar.isPending &&
              reemplazar.variables?.clave === casillero.clave
            }
            ocupado={ocupado}
            onReemplazar={(archivo) =>
              reemplazar.mutate({ clave: casillero.clave, archivo })
            }
            onRestaurar={() => setARestaurar(casillero)}
            onUsar={(version) => usar.mutate(version.id)}
            onEliminar={setAEliminar}
          />
        ))}
      </div>

      <AlertDialog
        open={aRestaurar !== null}
        onOpenChange={(abierto) => !abierto && setARestaurar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Restaurar el logo original de «{aRestaurar?.titulo}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vuelve a usarse el logo que trae el sistema. El que está en uso
              ahora no se borra: queda en el historial y se puede volver a
              elegir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restaurar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Sin esto el dialogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarRestauracion()
              }}
              disabled={restaurar.isPending}
            >
              Restaurar original
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={aEliminar !== null}
        onOpenChange={(abierto) => !abierto && setAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar este logo del historial?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el archivo y ya no se va a poder volver a usar. Si más
              adelante hiciera falta, habría que subirlo de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void confirmarEliminacion()
              }}
              disabled={eliminar.isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TarjetaLogoProps {
  casillero: Casillero
  logos: LogosVigentes | undefined
  cargando: boolean
  /** Las versiones anteriores de ESTE casillero (sin la vigente). */
  versiones: LogoVersion[]
  cargandoHistorial: boolean
  subiendo: boolean
  ocupado: boolean
  onReemplazar: (archivo: File) => void
  onRestaurar: () => void
  onUsar: (version: LogoVersion) => void
  onEliminar: (version: LogoVersion) => void
}

function TarjetaLogo({
  casillero,
  logos,
  cargando,
  versiones,
  cargandoHistorial,
  subiendo,
  ocupado,
  onReemplazar,
  onRestaurar,
  onUsar,
  onEliminar,
}: TarjetaLogoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const vigente = logos?.[casillero.clave]
  const reemplazado = Boolean(vigente?.url)

  function alElegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // Permite volver a elegir el MISMO archivo despues de un error.
    evento.target.value = ""
    if (!archivo) return

    const problema = validarImagen(archivo)
    setError(problema)
    if (!problema) onReemplazar(archivo)
  }

  return (
    <div className="flex flex-col rounded-md border bg-card shadow-sm">
      <div className="flex flex-col gap-1 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{casillero.titulo}</h2>
          {!cargando && (
            <Badge variant={reemplazado ? "default" : "secondary"}>
              {reemplazado ? "Reemplazado" : "Original"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{casillero.usos}</p>
      </div>

      <div
        className={cn(
          "flex h-40 items-center justify-center p-6",
          FONDO[casillero.fondo]
        )}
      >
        {cargando ? (
          <Skeleton className="h-full w-2/3" />
        ) : subiendo ? (
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        ) : (
          <img
            src={urlLogo(logos, casillero.clave)}
            alt={`Logo ${casillero.titulo}`}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      <div className="flex flex-col gap-3 border-t p-4">
        {reemplazado && vigente?.actualizadoEn && (
          <p className="text-xs text-muted-foreground">
            En uso desde el {fechaHora(vigente.actualizadoEn)}
            {vigente.actualizadoPor && ` · ${vigente.actualizadoPor}`}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={MIME_IMAGEN_PERMITIDOS.join(",")}
            onChange={alElegirArchivo}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={cargando || ocupado}
          >
            <ImagePlus className="size-4" />
            Reemplazar
          </Button>
          {reemplazado && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRestaurar}
              disabled={ocupado}
            >
              <RotateCcw className="size-4" />
              Restaurar original
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          JPG, PNG o WebP. Máx. 5 MB.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t bg-muted/30 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <History className="size-4 text-muted-foreground" />
          Historial
          {versiones.length > 0 && (
            <span className="text-muted-foreground">({versiones.length})</span>
          )}
        </h3>

        {cargandoHistorial ? (
          <Skeleton className="h-12 w-full" />
        ) : versiones.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin logos anteriores. Al reemplazar, el que está en uso queda acá.
          </p>
        ) : (
          // Tope de alto con scroll: el historial crece con cada cambio y no
          // debería empujar las otras dos tarjetas a una fila desparejada.
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {versiones.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-3 rounded-md border bg-card p-2"
              >
                <div
                  className={cn(
                    "flex h-12 w-20 shrink-0 items-center justify-center rounded border p-1",
                    FONDO[casillero.fondo]
                  )}
                >
                  <img
                    src={urlArchivo(version.url) ?? undefined}
                    alt={`Logo anterior de ${casillero.titulo}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p>{fechaHora(version.subidoEn)}</p>
                  {version.subidoPor && (
                    <p className="truncate text-muted-foreground">
                      {version.subidoPor}
                    </p>
                  )}
                </div>
                <IconAction
                  icono={Undo2}
                  etiqueta="Volver a usar este logo"
                  onClick={() => onUsar(version)}
                  disabled={ocupado}
                />
                <IconAction
                  icono={Trash2}
                  etiqueta="Eliminar del historial"
                  onClick={() => onEliminar(version)}
                  disabled={ocupado}
                  destructiva
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
