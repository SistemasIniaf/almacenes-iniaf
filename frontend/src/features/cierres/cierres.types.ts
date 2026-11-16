import type { EstadoEgreso } from "@/features/egresos/egresos.types"
import type { PaginationQuery } from "@/lib/types"

/** Espejo de `GET /cierres/estado`: qué le falta cerrar a cada almacén. */
export interface EstadoCierres {
  gestionActual: number
  almacenes: EstadoAlmacen[]
}

export interface EstadoAlmacen {
  almacen: { id: number; nombre: string; activo: boolean }
  ultimaCerrada: number | null
  /** null = no tiene nada que cerrar (al día, sin movimientos o dado de baja y vacío). */
  gestionPendiente: number | null
  /** La pendiente es la gestión EN CURSO: cerrarla congela el almacén hasta el 1/1. */
  anticipado: boolean
  /** Pedidos de la gestión pendiente sin entregar ni desistir: traban el cierre. */
  pedidosAbiertos: PedidoAbierto[]
}

export interface PedidoAbierto {
  id: number
  numero: number | null
  gestion: number | null
  estado: EstadoEgreso
  solicitante: { nombre: string }
}

export interface CierreListItem {
  id: number
  gestion: number
  anticipado: boolean
  cerradoEn: string
  valorInicial: string
  valorEntradas: string
  valorSalidas: string
  valorFinal: string
  almacen: { id: number; nombre: string }
  cerradoPor: { id: number; nombre: string; usuario: string }
}

/** Una fila de la FOTO: un lote con lo que tenía, entró, salió y quedó. */
export interface CierreSaldo {
  id: number
  ingresoDetalleId: number
  precioUnitario: string
  cantidadInicial: string
  cantidadEntradas: string
  cantidadEntradasTraspaso: string
  cantidadSalidas: string
  cantidadSalidasTraspaso: string
  cantidadFinal: string
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
  }
  partida: { id: number; codigo: string; denominacion: string }
  fuenteFinanciamiento: { id: number; nombre: string } | null
}

export interface DocumentosGestion {
  ingresosConfirmados: number
  ingresosAnulados: number
  egresosEntregados: number
  egresosAnulados: number
  egresosDesistidos: number
  traspasosEnviados: number
  traspasosRecibidos: number
}

export interface Cierre extends CierreListItem {
  saldos: CierreSaldo[]
  documentos: DocumentosGestion
}

export interface QueryCierres extends PaginationQuery {
  almacenId?: number
  gestion?: number
}

export interface CerrarGestionPayload {
  almacenId: number
  gestion: number
  confirmarAnticipado?: boolean
}

/** Espejo de `GET /cierres/gestiones`: las que tienen algún cierre. */
export interface GestionCerrada {
  gestion: number
  almacenesCerrados: number
}

export interface QueryCuadros {
  gestion: number
  /** Sin almacén: el cuadro INSTITUCIONAL (todos los que cerraron). */
  almacenId?: number
}

/** Una fila del Cuadro 6: un ítem a un precio (lotes y fuentes sumados). */
export interface FilaCuadro {
  itemId: number
  codigo: string
  descripcion: string
  unidadMedida: string
  partidaCodigo: string
  partidaDenominacion: string
  precio: string
  cantInicial: string
  cantEntradas: string
  cantSalidas: string
  cantFinal: string
  valInicial: string
  valEntradas: string
  valSalidas: string
  valFinal: string
}

/** Espejo de `GET /cierres/cuadros`. */
export interface DatosCuadros {
  gestion: number
  /** null = institucional. */
  almacen: { id: number; nombre: string } | null
  /** Institucional con algún almacén que todavía no cerró la gestión. */
  provisional: boolean
  pendientes: { id: number; nombre: string }[]
  cierres: {
    almacen: { id: number; nombre: string }
    anticipado: boolean
    cerradoEn: string
  }[]
  filas: FilaCuadro[]
}
