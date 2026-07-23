import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { Rol } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
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
    const campos = this.resolverCamposPorRol(dto.rol, dto, null);
    const cargo = this.resolverCargo(dto.rol, dto.cargo, null);

    await this.validarReferencias(campos);
    await this.validarUnicidadRol(dto.rol, campos, activo);

    const password = await bcrypt.hash(dto.password, 10);

    const id = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: aMayusculas(dto.nombre),
          cargo,
          usuario: dto.usuario,
          password,
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
   * de "responsable de conformidad" del Ingreso. Accesible tambien al
   * responsable_almacen (que registra ingresos), a diferencia del CRUD completo.
   */
  async solicitadores() {
    return this.prisma.usuario.findMany({
      where: { rol: Rol.solicitador, activo: true },
      select: { id: true, nombre: true, usuario: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async update(id: number, dto: UpdateUsuarioDto) {
    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      include: { almacenesObservados: { select: { almacenId: true } } },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }

    if (dto.usuario && dto.usuario !== existente.usuario) {
      await this.validarUsernameLibre(dto.usuario);
    }

    const rolFinal = dto.rol ?? existente.rol;
    const activoFinal = dto.activo ?? existente.activo;
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
          ...(password ? { password } : {}),
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
  async remove(id: number) {
    const existente = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, activo: true },
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

  // ---------------------------------------------------------------------------
  // Validaciones
  // ---------------------------------------------------------------------------

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
