import { Link, useNavigate } from "react-router-dom"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Boxes,
  CheckCircle2,
  FileEdit,
  Inbox,
  PackageCheck,
  Plus,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { ROL_LABEL } from "@/features/auth/lib/auth.types"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { TarjetaResumen } from "@/features/dashboard/components/TarjetaResumen"
import {
  useConteoEgresos,
  useConteoIngresos,
} from "@/features/dashboard/hooks/useResumen"
import {
  ESTADO_LABEL,
  ESTADO_VARIANT,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"
import { useEgresos } from "@/features/egresos/hooks/useEgresos"
import { getApiErrorMessage } from "@/lib/api"

import type { LucideIcon } from "lucide-react"
import type { Rol } from "@/features/auth/lib/auth.types"
import type { Permiso } from "@/features/auth/lib/permisos"

/** Qué le toca hacer a cada rol, en una línea. */
const BAJADA: Record<Rol, string> = {
  super_admin:
    "Tenés acceso a todo: catálogos, almacenes y el circuito completo de ingresos y egresos.",
  admin:
    "Administrás el sistema y seguís los ingresos y egresos de todos los almacenes.",
  solicitador:
    "Armá tus pedidos de material, seguilos hasta la entrega y consultá qué hay disponible.",
  aprobador:
    "Aprobás o rechazás los pedidos de tu unidad. Las cantidades las ajusta el almacén al entregar.",
  responsable_almacen:
    "Registrás los ingresos de tu almacén y entregás el material de los pedidos aprobados.",
  observador_almacen:
    "Consultás el stock, el kardex y los movimientos de los almacenes que tenés asignados.",
}

interface AccesoRapido {
  titulo: string
  a: string
  icono: LucideIcon
  permiso: Permiso
  principal?: boolean
}

const ACCESOS: AccesoRapido[] = [
  {
    titulo: "Nuevo pedido",
    a: "/egresos/nuevo",
    icono: Plus,
    permiso: "egresosCrear",
    principal: true,
  },
  {
    titulo: "Registrar ingreso",
    a: "/ingresos/nuevo",
    icono: ArrowDownToLine,
    permiso: "ingresosEscribir",
    principal: true,
  },
  { titulo: "Stock", a: "/stock", icono: Boxes, permiso: "stockLeer" },
  { titulo: "Kardex", a: "/kardex", icono: BookOpen, permiso: "kardexLeer" },
  { titulo: "Ítems", a: "/items", icono: PackageCheck, permiso: "itemsEscribir" },
  { titulo: "Usuarios", a: "/usuarios", icono: Users, permiso: "usuariosEscribir" },
]

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—"

export function DashboardHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const gestion = new Date().getFullYear()

  const rol = user?.rol
  const esSolicitador = rol === "solicitador"
  const esAprobador = rol === "aprobador"
  const esResponsable = rol === "responsable_almacen"
  // Los dos roles que deciden algo: su tabla es la bandeja, no el histórico.
  const tieneBandeja = esAprobador || esResponsable
  const veIngresos = tienePermiso(user, "ingresosLeer")

  // Cada conteo significa lo correcto para quien lo pide porque el alcance lo
  // aplica el backend (los míos / los de mi unidad / los de mi almacén).
  const borradores = useConteoEgresos({ estado: "BORRADOR" }, esSolicitador)
  const conJefe = useConteoEgresos({ estado: "PENDIENTE_APROBADOR" })
  const enAlmacen = useConteoEgresos({
    estado: "PENDIENTE_RESPONSABLE_ALMACEN",
  })
  const entregados = useConteoEgresos({ estado: "ENTREGADO", gestion })
  const ingresos = useConteoIngresos({ estado: "CONFIRMADO", gestion }, veIngresos)

  const {
    data: bandeja,
    isPending,
    isError,
    error,
  } = useEgresos({
    page: 1,
    pageSize: 5,
    pendientesMios: tieneBandeja || undefined,
  })

  const pedidos = bandeja?.data ?? []
  const accesos = ACCESOS.filter((acceso) => tienePermiso(user, acceso.permiso))

  // Las tarjetas dicen lo mismo para todos; lo que cambia es el detalle debajo
  // y a qué conjunto de pedidos alcanza cada rol (eso lo aplica el backend).
  const tarjetas = [
    ...(esSolicitador
      ? [
          {
            titulo: "Pendientes de envío",
            valor: borradores.data,
            cargando: borradores.isPending,
            detalle: "Pedidos tuyos que todavía no salieron",
            a: "/egresos?estado=BORRADOR",
            icono: FileEdit,
            urgente: true,
          },
        ]
      : []),
    {
      titulo: "Pendientes de aprobación",
      valor: conJefe.data,
      cargando: conJefe.isPending,
      detalle: esAprobador
        ? "Pedidos de tu unidad pendientes de tu aprobación"
        : "Enviados, todavía sin aprobar",
      a: "/egresos?estado=PENDIENTE_APROBADOR",
      icono: Inbox,
      urgente: esAprobador,
    },
    {
      titulo: "Pendientes de entrega",
      valor: enAlmacen.data,
      cargando: enAlmacen.isPending,
      detalle: esResponsable
        ? "Ya aprobados, esperan que los entregues"
        : "Aprobados, en manos del almacén",
      a: "/egresos?estado=PENDIENTE_RESPONSABLE_ALMACEN",
      icono: ArrowUpFromLine,
      urgente: esResponsable,
    },
    {
      titulo: "Entregados",
      valor: entregados.data,
      cargando: entregados.isPending,
      detalle: `Pedidos entregados en la gestión ${gestion}`,
      a: "/egresos?estado=ENTREGADO",
      icono: CheckCircle2,
    },
    ...(veIngresos
      ? [
          {
            titulo: "Ingresos",
            valor: ingresos.data,
            cargando: ingresos.isPending,
            detalle: `Registrados en la gestión ${gestion}`,
            a: "/ingresos",
            icono: ArrowDownToLine,
          },
        ]
      : []),
  ]

  const tituloTabla = esAprobador
    ? "Esperando tu firma"
    : esResponsable
      ? "Listos para entregar"
      : esSolicitador
        ? "Tus últimos pedidos"
        : "Últimos pedidos"

  const tablaVacia = esAprobador
    ? "No hay pedidos esperando tu firma."
    : esResponsable
      ? "No hay pedidos listos para entregar."
      : esSolicitador
        ? "Todavía no hiciste ningún pedido."
        : "Todavía no hay pedidos."

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {user?.nombre ?? user?.usuario}
          </h1>
          <p className="text-sm text-muted-foreground">
            {rol ? BAJADA[rol] : ""}
          </p>
        </div>
        {rol && <Badge variant="outline">{ROL_LABEL[rol]}</Badge>}
      </div>

      {accesos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accesos.map((acceso) => (
            <Button
              key={acceso.a}
              variant={acceso.principal ? "default" : "outline"}
              asChild
            >
              <Link to={acceso.a}>
                <acceso.icono className="size-4" />
                {acceso.titulo}
              </Link>
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <TarjetaResumen key={tarjeta.titulo} {...tarjeta} />
        ))}
      </div>

      <Card className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{tituloTabla}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/egresos">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nº</TableHead>
                <TableHead>Fecha</TableHead>
                {!esSolicitador && <TableHead>Solicitante</TableHead>}
                <TableHead>Justificación</TableHead>
                <TableHead className="text-center">Ítems</TableHead>
                <TableHead className="pr-6">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending &&
                Array.from({ length: 3 }).map((_, fila) => (
                  <TableRow key={fila}>
                    {Array.from({ length: esSolicitador ? 5 : 6 }).map(
                      (__, celda) => (
                        <TableCell key={celda}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      )
                    )}
                  </TableRow>
                ))}

              {isError && (
                <TableRow>
                  <TableCell
                    colSpan={esSolicitador ? 5 : 6}
                    className="py-8 text-center text-sm text-destructive"
                  >
                    {getApiErrorMessage(error, "No se pudieron cargar los pedidos.")}
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError && pedidos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={esSolicitador ? 5 : 6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {tablaVacia}
                  </TableCell>
                </TableRow>
              )}

              {!isError &&
                pedidos.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/egresos/${pedido.id}`)}
                  >
                    <TableCell className="pl-6 font-medium whitespace-nowrap">
                      {etiquetaNumero(pedido)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fecha(pedido.fechaEnvio ?? pedido.createdAt)}
                    </TableCell>
                    {!esSolicitador && (
                      <TableCell>{pedido.solicitante.nombre}</TableCell>
                    )}
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {pedido.justificacion}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {pedido._count.detalles}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge variant={ESTADO_VARIANT[pedido.estado]}>
                        {ESTADO_LABEL[pedido.estado]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
