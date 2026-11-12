import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { EstadoEgreso, EstadoIngreso } from '../../generated/prisma/enums';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { QueryAlmacenesDto } from './dto/query-almacenes.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';

// Trae las unidades enlazadas (catalogo compartido) junto al almacen. Incluye
// padreId y grupo para que el frontend muestre solo las raices agrupadas.
const includeUnidades = {
  unidades: {
    include: {
      unidad: {
        select: {
          id: true,
          nombre: true,
          sigla: true,
          activo: true,
          grupo: true,
          padreId: true,
        },
      },
    },
    orderBy: { unidad: { nombre: 'asc' } },
  },
} as const;

type AlmacenCrudo = {
  unidades: {
    unidad: {
      id: number;
      nombre: string;
      sigla: string;
      activo: boolean;
      grupo: string | null;
      padreId: number | null;
    };
  }[];
  [k: string]: unknown;
};

/** Aplana la tabla puente: `unidades: [{id,nombre,sigla,activo}]`. */
function aplanar<T extends AlmacenCrudo>(almacen: T) {
  const { unidades, ...resto } = almacen;
  return { ...resto, unidades: unidades.map((au) => au.unidad) };
}

@Injectable()
export class AlmacenesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlmacenDto) {
    await this.validarUnicidad(dto.nombre);
    const unidadIds = dto.unidadIds ?? [];
    await this.validarUnidades(unidadIds);

    const almacen = await this.prisma.almacen.create({
      data: {
        nombre: dto.nombre,
        activo: dto.activo ?? true,
        unidades: { create: unidadIds.map((unidadId) => ({ unidadId })) },
      },
      select: { id: true },
    });
    return this.findOne(almacen.id);
  }

  async findAll(query: QueryAlmacenesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(this.prisma, 'almacenes', ['nombre'], query.q)
      : null;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const orderBy =
      query.orden === 'nombre'
        ? [{ nombre: 'asc' as const }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [data, total] = await Promise.all([
      this.prisma.almacen.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: includeUnidades,
      }),
      this.prisma.almacen.count({ where }),
    ]);

    return paginated(data.map(aplanar), total, page, pageSize);
  }

  async findOne(id: number) {
    const almacen = await this.prisma.almacen.findUnique({
      where: { id },
      include: includeUnidades,
    });
    if (!almacen) {
      throw new NotFoundException(`No existe el almacen con id ${id}`);
    }
    return aplanar(almacen);
  }

  async update(id: number, dto: UpdateAlmacenDto) {
    const existente = await this.prisma.almacen.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`No existe el almacen con id ${id}`);
    }

    const nombre =
      dto.nombre !== undefined && dto.nombre !== existente.nombre
        ? dto.nombre
        : undefined;
    await this.validarUnicidad(nombre, id);
    // El checkbox «Activo» del formulario es la otra vía para dar de baja.
    if (dto.activo === false && existente.activo) {
      await this.validarCierre(id, existente.nombre);
    }
    if (dto.unidadIds !== undefined) {
      await this.validarUnidades(dto.unidadIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.almacen.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });
      // Reemplaza el conjunto de unidades (si vino en el payload).
      if (dto.unidadIds !== undefined) {
        await tx.almacenUnidad.deleteMany({ where: { almacenId: id } });
        if (dto.unidadIds.length > 0) {
          await tx.almacenUnidad.createMany({
            data: dto.unidadIds.map((unidadId) => ({
              almacenId: id,
              unidadId,
            })),
          });
        }
      }
    });

    return this.findOne(id);
  }

  /** Baja logica (desactiva). No se borra para preservar la referencia de usuarios/stock. */
  async remove(id: number) {
    const existente = await this.prisma.almacen.findUnique({
      where: { id },
      select: { id: true, activo: true, nombre: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el almacen con id ${id}`);
    }
    if (existente.activo) {
      await this.validarCierre(id, existente.nombre);
      await this.prisma.almacen.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
  }

  /**
   * Un almacen se da de baja VACIO. Si no, quedan cosas colgadas de un almacen
   * inactivo: material que nadie puede pedir, pedidos que esperan para siempre
   * y usuarios que siguen entrando a operar sobre el. Se responde con TODO lo
   * que falta resolver de una vez, no de a un problema por intento.
   *
   * - Pedidos: todo egreso no cerrado, incluidos los sin enviar — reservan
   *   material y su solicitante los sigue viendo como suyos. Van primero porque
   *   el traspaso solo mueve lo DISPONIBLE: lo reservado no sale hasta
   *   resolverlos.
   * - Saldo: lotes de ingresos confirmados con saldo > 0. Se vacia con un
   *   traspaso.
   * - Usuarios: activos con este almacen asignado. Los observadores no cuentan:
   *   mirar un almacen cerrado no rompe nada y sirve para auditarlo.
   *
   * Es una verificacion previa, no transaccional: solo el super_admin da de
   * baja almacenes, asi que la carrera con un ingreso simultaneo no compensa
   * bloquear tres tablas.
   */
  private async validarCierre(id: number, nombre: string) {
    const [pedidos, lotes, usuarios] = await Promise.all([
      this.prisma.egreso.count({
        where: {
          almacenId: id,
          estado: {
            in: [
              EstadoEgreso.BORRADOR,
              EstadoEgreso.DEVUELTO,
              EstadoEgreso.PENDIENTE_APROBADOR,
              EstadoEgreso.PENDIENTE_RESPONSABLE_ALMACEN,
            ],
          },
        },
      }),
      this.prisma.ingresoDetalle.count({
        where: {
          saldoCantidad: { gt: 0 },
          ingreso: { almacenId: id, estado: EstadoIngreso.CONFIRMADO },
        },
      }),
      this.prisma.usuario.count({ where: { almacenId: id, activo: true } }),
    ]);

    const pendientes: string[] = [];
    if (pedidos > 0) {
      pendientes.push(
        `${pedidos} ${pedidos === 1 ? 'pedido sin cerrar' : 'pedidos sin cerrar'} (entregar, rechazar, desistir o descartar)`,
      );
    }
    if (lotes > 0) {
      pendientes.push(
        `${lotes} ${lotes === 1 ? 'lote con saldo' : 'lotes con saldo'} (traspasar a otro almacén)`,
      );
    }
    if (usuarios > 0) {
      pendientes.push(
        `${usuarios} ${usuarios === 1 ? 'usuario activo asignado' : 'usuarios activos asignados'} (reasignar o dar de baja)`,
      );
    }
    if (pendientes.length > 0) {
      throw new ConflictException(
        `No se puede desactivar «${nombre}» todavía. Falta resolver: ${pendientes.join('; ')}.`,
      );
    }
  }

  /** Valida unicidad de nombre (excluyendo el propio id en updates). */
  private async validarUnicidad(nombre?: string, excluirId?: number) {
    if (nombre === undefined) {
      return;
    }
    const excluir = excluirId ? { id: { not: excluirId } } : {};
    const existe = await this.prisma.almacen.findFirst({
      where: { nombre, ...excluir },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(
        `Ya existe un almacen con el nombre "${nombre}"`,
      );
    }
  }

  /** Verifica que todas las unidades seleccionadas existan en el catalogo. */
  private async validarUnidades(unidadIds: number[]) {
    if (unidadIds.length === 0) return;
    const encontradas = await this.prisma.unidad.count({
      where: { id: { in: unidadIds } },
    });
    if (encontradas !== unidadIds.length) {
      throw new BadRequestException(
        'Alguna de las unidades seleccionadas no existe',
      );
    }
  }
}
