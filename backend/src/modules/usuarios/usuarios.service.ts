import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { Rol } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

// Reglas de campos por rol.
// Los tres roles del circuito de egresos (solicitador -> aprobador ->
// responsable_almacen) llevan unidad Y almacen. La unicidad no va junta con eso:
// el aprobador es unico por UNIDAD y el responsable, unico por ALMACEN.
const ROLES_CON_UNIDAD: Rol[] = [
  Rol.solicitador,
  Rol.aprobador,
  Rol.responsable_almacen,
];
const ROLES_CON_ALMACEN: Rol[] = [
  Rol.solicitador,
  Rol.aprobador,
  Rol.responsable_almacen,
];
const ROLES_UNICOS_POR_UNIDAD: Rol[] = [Rol.aprobador];
const ROLES_UNICOS_POR_ALMACEN: Rol[] = [Rol.responsable_almacen];

// Los dos roles administrativos no ocupan un puesto en el organigrama, asi que
// son los unicos sin cargo. Para el resto es obligatorio.
const ROLES_SIN_CARGO: Rol[] = [Rol.super_admin, Rol.admin];

/**
 * `nombre` y `cargo` se guardan en MAYUSCULAS (pedido de la institucion: es como
 * figuran en los documentos oficiales). El frontend ademas lo fuerza al escribir,
 * pero se normaliza aca tambien porque la API es la fuente de verdad.
 */
function aMayusculas(texto: string): string {
  return texto.trim().toUpperCase();
}

// Campos que se devuelven al cliente (nunca el password).
const usuarioSelect = {
  id: true,
  nombre: true,
  cargo: true,
  usuario: true,
  rol: true,
  activo: true,
  // Para que la tabla marque quien todavia no cambio la contraseña inicial.
  conClaveInicial: true,
  unidadId: true,
  almacenId: true,
  unidad: { select: { id: true, nombre: true, sigla: true } },
  almacen: { select: { id: true, nombre: true } },
  almacenesObservados: {
    select: { almacen: { select: { id: true, nombre: true } } },
  },
  createdAt: true,
  updatedAt: true,
} as const;

interface CamposRol {
  unidadId: number | null;
  almacenId: number | null;
  observados: number[];
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    await this.validarUsernameLibre(dto.usuario);
    const activo = dto.activo ?? true;
    await this.validarSuperAdminUnico(dto.rol);
    await this.validarAdminUnico(dto.rol, activo);

    const campos = this.resolverCamposPorRol(dto.rol, dto, null);
    const cargo = this.resolverCargo(dto.rol, dto.cargo, null);

    await this.validarReferencias(campos);
    await this.validarUnicidadRol(dto.rol, campos, activo);

    const password = await bcrypt.hash(await this.claveInicial(), 10);

    const id = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: aMayusculas(dto.nombre),
          cargo,
          usuario: dto.usuario,
          password,
          conClaveInicial: true,
          rol: dto.rol,
          activo,
          unidadId: campos.unidadId,
          almacenId: campos.almacenId,
        },
        select: { id: true },
      });
      if (campos.observados.length > 0) {
        await tx.usuarioAlmacenObservado.createMany({
          data: campos.observados.map((almacenId) => ({
            usuarioId: usuario.id,
            almacenId,
          })),
        });
      }
      return usuario.id;
    });

    return this.findOne(id);
  }

  async findAll(query: QueryUsuariosDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'usuarios',
          ['nombre', 'usuario'],
          query.q,
        )
      : null;

    const where = {
      ...(query.rol ? { rol: query.rol } : {}),
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.unidadId ? { unidadId: query.unidadId } : {}),
      ...(query.almacenId ? { almacenId: query.almacenId } : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        select: usuarioSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });
    if (!usuario) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    return usuario;
  }

  /**
   * Lista chica de solicitadores activos (id, nombre, usuario), para el selector
   * de "responsable / comision de recepcion" del Ingreso. Accesible tambien al
   * responsable_almacen (que registra ingresos), a diferencia del CRUD completo.
   */
  async solicitadores() {
    return this.prisma.usuario.findMany({
      where: { rol: Rol.solicitador, activo: true },
      select: { id: true, nombre: true, usuario: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Quien aprueba los pedidos de una unidad: su `aprobador` ACTIVO (hay uno solo,
   * lo garantiza el indice unico parcial `uq_aprobador_por_unidad`). Devuelve
   * null si la unidad no tiene ninguno — caso real: el aprobador se dio de baja
   * y todavia no se designo el reemplazo. Ahi los pedidos esperan (no hay
   * suplencia, decision del encargado), y avisarlo ANTES de enviar le ahorra al
   * solicitante preguntarse por que su pedido no avanza.
   */
  async aprobadorDeUnidad(unidadId: number) {
    return this.prisma.usuario.findFirst({
      where: { rol: Rol.aprobador, activo: true, unidadId },
      select: { id: true, nombre: true, cargo: true },
    });
  }

  async update(
    id: number,
    dto: UpdateUsuarioDto,
    actingUser: AuthenticatedUser,
  ) {
    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      include: { almacenesObservados: { select: { almacenId: true } } },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }

    const rolFinal = dto.rol ?? existente.rol;
    const activoFinal = dto.activo ?? existente.activo;
    const esPropiaCuenta = id === actingUser.id;

    // Editar es exclusivo del super_admin (el controlador ya lo garantiza con
    // @Roles); acá solo queda la unica restriccion que rige incluso para el
    // super_admin: nadie se desactiva a si mismo.
    if (esPropiaCuenta && !activoFinal) {
      throw new ForbiddenException('No podés desactivar tu propia cuenta.');
    }

    if (dto.usuario && dto.usuario !== existente.usuario) {
      await this.validarUsernameLibre(dto.usuario);
    }

    await this.validarSuperAdminUnico(rolFinal, id);
    await this.validarAdminUnico(rolFinal, activoFinal, id);

    const campos = this.resolverCamposPorRol(rolFinal, dto, {
      unidadId: existente.unidadId,
      almacenId: existente.almacenId,
      observados: existente.almacenesObservados.map((o) => o.almacenId),
    });
    const cargo = this.resolverCargo(rolFinal, dto.cargo, existente.cargo);

    await this.validarReferencias(campos);
    await this.validarUnicidadRol(rolFinal, campos, activoFinal, id);

    const password = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined
            ? { nombre: aMayusculas(dto.nombre) }
            : {}),
          // `cargo` se recalcula siempre: al cambiar de rol puede pasar a ser
          // requerido (o dejar de serlo) sin que el cliente lo mande.
          cargo,
          ...(dto.usuario !== undefined ? { usuario: dto.usuario } : {}),
          // Una contraseña puesta por el super_admin se la DIERON, igual que la
          // inicial: queda marcada. Salvo que se la esté poniendo a sí mismo.
          ...(password
            ? { password, conClaveInicial: id !== actingUser.id }
            : {}),
          rol: rolFinal,
          activo: activoFinal,
          unidadId: campos.unidadId,
          almacenId: campos.almacenId,
        },
      });
      // Reconciliar los almacenes observados (reemplazo del conjunto).
      await tx.usuarioAlmacenObservado.deleteMany({ where: { usuarioId: id } });
      if (campos.observados.length > 0) {
        await tx.usuarioAlmacenObservado.createMany({
          data: campos.observados.map((almacenId) => ({
            usuarioId: id,
            almacenId,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  /** Baja logica: desactiva al usuario (libera su cupo de rol unico). Nunca se borra. */
  async remove(id: number, actingUser: AuthenticatedUser) {
    if (id === actingUser.id) {
      throw new ForbiddenException('No podés desactivar tu propia cuenta.');
    }

    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, activo: true, rol: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
  }

  /**
   * Reactiva (inverso de la baja logica). A diferencia de `remove`, no hace
   * falta bloquear la propia cuenta (reactivarse a uno mismo no tiene el
   * riesgo de quedarse afuera).
   */
  async activar(id: number) {
    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        activo: true,
        rol: true,
        unidadId: true,
        almacenId: true,
      },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    if (!existente.activo) {
      // El cupo de rol unico (aprobador por unidad, responsable por almacen)
      // pudo haberse ocupado mientras esta cuenta estaba inactiva.
      await this.validarUnicidadRol(
        existente.rol,
        {
          unidadId: existente.unidadId,
          almacenId: existente.almacenId,
          observados: [],
        },
        true,
        id,
      );
      // Mismo motivo: si mientras tanto se creo un super_admin nuevo (el
      // unico camino posible, porque nadie puede desactivarse a si mismo),
      // reactivar esta cuenta dejaria dos activos a la vez.
      await this.validarSuperAdminUnico(existente.rol, id);
      await this.validarAdminUnico(existente.rol, true, id);
      await this.prisma.usuario.update({
        where: { id },
        data: { activo: true },
      });
    }
    return this.findOne(id);
  }

  // ---------------------------------------------------------------------------
  // Contraseña inicial (2026-10-29)
  // ---------------------------------------------------------------------------

  /**
   * Datos de acceso para copiar y mandar por WhatsApp o correo (el ícono junto
   * al usuario en la tabla). La contraseña va SOLO si la cuenta todavía tiene
   * la inicial VIGENTE; si no, `null` y la pantalla copia sin ella.
   *
   * Se compara contra el hash y no se confía en `conClaveInicial`: la marca
   * no distingue si la inicial cambió después de crear la cuenta (la cuenta
   * conserva la vieja), ni una contraseña puesta por el super_admin al editar.
   * Revelarla no filtra nada: es la inicial, que quien consulta (solo el
   * super_admin) ya puede ver.
   */
  async credenciales(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { usuario: true, password: true, conClaveInicial: true },
    });
    if (!usuario) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    const inicial = await this.claveInicial();
    const tieneLaInicial =
      usuario.conClaveInicial &&
      (await bcrypt.compare(inicial, usuario.password));
    return {
      usuario: usuario.usuario,
      claveInicial: tieneLaInicial ? inicial : null,
    };
  }

  /**
   * Vuelve la contraseña de un usuario a la INICIAL: es la salida para «me
   * olvidé la contraseña» sin que nadie tenga que inventar una. La propia no:
   * para eso está «Cambiar contraseña».
   */
  async restablecerClave(id: number, actingUser: AuthenticatedUser) {
    if (id === actingUser.id) {
      throw new BadRequestException(
        'Tu propia contraseña se cambia desde «Cambiar contraseña», en tu menú de usuario.',
      );
    }
    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    await this.prisma.usuario.update({
      where: { id },
      data: {
        password: await bcrypt.hash(await this.claveInicial(), 10),
        conClaveInicial: true,
      },
    });
    return this.findOne(id);
  }

  /**
   * La contraseña inicial vigente, para mostrársela al super_admin (tiene que
   * dársela al usuario nuevo) y con quién la cambió por última vez.
   */
  async obtenerClaveInicial() {
    return this.prisma.configuracionSistema.findUniqueOrThrow({
      where: { id: 1 },
      select: {
        claveInicial: true,
        updatedAt: true,
        actualizadoPor: { select: { id: true, nombre: true } },
      },
    });
  }

  /**
   * Cambia la contraseña inicial. Rige para las cuentas que se creen o
   * restablezcan DE ACÁ EN ADELANTE: las que ya la tienen pendiente de cambio
   * conservan la anterior (está hasheada en cada cuenta, no se puede
   * «re-aplicar» sin pisar algo).
   */
  async actualizarClaveInicial(
    claveInicial: string,
    actingUser: AuthenticatedUser,
  ) {
    await this.prisma.configuracionSistema.update({
      where: { id: 1 },
      data: { claveInicial, actualizadoPorId: actingUser.id },
    });
    return this.obtenerClaveInicial();
  }

  private async claveInicial(): Promise<string> {
    return (await this.obtenerClaveInicial()).claveInicial;
  }

  // ---------------------------------------------------------------------------
  // Validaciones
  // ---------------------------------------------------------------------------

  /**
   * Solo puede existir un super_admin en todo el sistema (mismo criterio que
   * el bootstrap del seed: busca CUALQUIER super_admin, activo o no). Es lo
   * que hace inofensivo que nadie mas pueda gestionar esa cuenta: si se
   * permitiera un segundo, un super_admin inactivo dejaria al otro sin forma
   * de reactivarlo salvo por acceso directo a la base.
   */
  private async validarSuperAdminUnico(rol: Rol, excluirId?: number) {
    if (rol !== Rol.super_admin) return;
    const existe = await this.prisma.usuario.findFirst({
      where: {
        rol: Rol.super_admin,
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(
        'Ya existe un super_admin en el sistema; no se puede crear otro.',
      );
    }
  }

  /**
   * Solo puede haber un `admin` ACTIVO a la vez (2026-10-12, pedido del
   * usuario) — a diferencia de `validarSuperAdminUnico`, acá alcanza con
   * mirar los activos: un admin siempre puede ser reactivado o reemplazado
   * por el super_admin (nunca hay riesgo de quedar sin nadie que lo pueda
   * tocar, como sí pasaba con el super_admin), así que no hace falta la
   * regla más estricta de "ningún otro registro, esté activo o no". Por eso
   * sigue el mismo patrón que `ROLES_UNICOS_POR_UNIDAD`/`_POR_ALMACEN`: solo
   * corre cuando el resultado de la operación deja la cuenta activa.
   */
  private async validarAdminUnico(
    rol: Rol,
    activo: boolean,
    excluirId?: number,
  ) {
    if (rol !== Rol.admin || !activo) return;
    const existe = await this.prisma.usuario.findFirst({
      where: {
        rol: Rol.admin,
        activo: true,
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
      select: { id: true, usuario: true },
    });
    if (existe) {
      throw new ConflictException(
        `Ya hay un admin activo (usuario "${existe.usuario}"); da de baja esa cuenta antes de activar o crear otra.`,
      );
    }
  }

  private async validarUsernameLibre(usuario: string) {
    const existe = await this.prisma.usuario.findUnique({
      where: { usuario },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(`El usuario "${usuario}" ya esta en uso`);
    }
  }

  /**
   * Cargo final del usuario, ya en mayusculas. Es obligatorio para todos los
   * roles operativos; los administrativos (super_admin/admin) pueden no tenerlo.
   * En update, `undefined` significa "no lo mandaron" y se conserva el existente.
   */
  private resolverCargo(
    rol: Rol,
    entrada: string | null | undefined,
    existente: string | null,
  ): string | null {
    const valor = entrada !== undefined ? entrada : existente;
    const cargo = valor ? aMayusculas(valor) : null;

    if (!cargo && !ROLES_SIN_CARGO.includes(rol)) {
      throw new BadRequestException(`El rol ${rol} requiere un cargo`);
    }
    return cargo;
  }

  /**
   * Determina los valores finales de unidadId/almacenId/observados segun el rol.
   * - Rechaza campos prohibidos que se hayan enviado explicitamente.
   * - Exige los campos requeridos por el rol (tomando el valor enviado o el existente).
   */
  private resolverCamposPorRol(
    rol: Rol,
    entrada: {
      unidadId?: number | null;
      almacenId?: number | null;
      almacenesObservados?: number[];
    },
    existente: CamposRol | null,
  ): CamposRol {
    const requiereUnidad = ROLES_CON_UNIDAD.includes(rol);
    const requiereAlmacen = ROLES_CON_ALMACEN.includes(rol);
    const permiteObservados = rol === Rol.observador_almacen;

    if (!requiereUnidad && entrada.unidadId != null) {
      throw new BadRequestException(`El rol ${rol} no lleva unidad`);
    }
    if (!requiereAlmacen && entrada.almacenId != null) {
      throw new BadRequestException(`El rol ${rol} no lleva almacen`);
    }
    if (
      !permiteObservados &&
      entrada.almacenesObservados &&
      entrada.almacenesObservados.length > 0
    ) {
      throw new BadRequestException(
        'Solo el rol observador_almacen puede tener almacenes observados',
      );
    }

    const unidadId = requiereUnidad
      ? entrada.unidadId !== undefined
        ? entrada.unidadId
        : (existente?.unidadId ?? null)
      : null;
    const almacenId = requiereAlmacen
      ? entrada.almacenId !== undefined
        ? entrada.almacenId
        : (existente?.almacenId ?? null)
      : null;

    if (requiereUnidad && unidadId == null) {
      throw new BadRequestException(`El rol ${rol} requiere una unidad`);
    }
    if (requiereAlmacen && almacenId == null) {
      throw new BadRequestException(`El rol ${rol} requiere un almacen`);
    }

    let observados: number[] = [];
    if (permiteObservados) {
      observados =
        entrada.almacenesObservados !== undefined
          ? entrada.almacenesObservados
          : (existente?.observados ?? []);
    }

    return { unidadId, almacenId, observados };
  }

  /** Verifica que la unidad, el almacen y los almacenes observados existan y esten activos. */
  private async validarReferencias(campos: CamposRol) {
    if (campos.unidadId != null) {
      const unidad = await this.prisma.unidad.findUnique({
        where: { id: campos.unidadId },
        select: { activo: true },
      });
      if (!unidad) {
        throw new BadRequestException(
          `No existe la unidad con id ${campos.unidadId}`,
        );
      }
      if (!unidad.activo) {
        throw new BadRequestException(
          `La unidad con id ${campos.unidadId} esta inactiva`,
        );
      }
    }

    const almacenesARevisar = new Set<number>();
    if (campos.almacenId != null) almacenesARevisar.add(campos.almacenId);
    campos.observados.forEach((a) => almacenesARevisar.add(a));

    if (almacenesARevisar.size > 0) {
      const encontrados = await this.prisma.almacen.findMany({
        where: { id: { in: [...almacenesARevisar] } },
        select: { id: true, activo: true },
      });
      const porId = new Map(encontrados.map((a) => [a.id, a.activo]));
      for (const almacenId of almacenesARevisar) {
        if (!porId.has(almacenId)) {
          throw new BadRequestException(
            `No existe el almacen con id ${almacenId}`,
          );
        }
        if (!porId.get(almacenId)) {
          throw new BadRequestException(
            `El almacen con id ${almacenId} esta inactivo`,
          );
        }
      }
    }
  }

  /**
   * Unicidad de roles (complementa los indices unicos parciales de la BD):
   * un aprobador activo por unidad y un responsable_almacen activo por almacen.
   * Solo aplica cuando el usuario queda ACTIVO.
   */
  private async validarUnicidadRol(
    rol: Rol,
    campos: CamposRol,
    activo: boolean,
    excluirId?: number,
  ) {
    if (!activo) return;
    const excluir = excluirId ? { id: { not: excluirId } } : {};

    if (ROLES_UNICOS_POR_UNIDAD.includes(rol) && campos.unidadId != null) {
      const otro = await this.prisma.usuario.findFirst({
        where: { rol, activo: true, unidadId: campos.unidadId, ...excluir },
        select: { id: true, usuario: true },
      });
      if (otro) {
        throw new ConflictException(
          `La unidad ya tiene un ${rol} activo (usuario "${otro.usuario}")`,
        );
      }
    }

    if (ROLES_UNICOS_POR_ALMACEN.includes(rol) && campos.almacenId != null) {
      const otro = await this.prisma.usuario.findFirst({
        where: { rol, activo: true, almacenId: campos.almacenId, ...excluir },
        select: { id: true, usuario: true },
      });
      if (otro) {
        throw new ConflictException(
          `El almacen ya tiene un ${rol} activo (usuario "${otro.usuario}")`,
        );
      }
    }
  }
}
