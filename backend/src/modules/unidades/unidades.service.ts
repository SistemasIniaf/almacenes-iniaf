import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { PrismaService } from '../../prisma/prisma.service';
import { Unidad } from '../../generated/prisma/client';
import { CreateUnidadDto } from './dto/create-unidad.dto';
import { QueryArbolUnidadesDto } from './dto/query-arbol-unidades.dto';
import { QueryUnidadesDto } from './dto/query-unidades.dto';
import { UpdateUnidadDto } from './dto/update-unidad.dto';

/** Nodo del arbol jerarquico: la unidad mas sus hijos anidados. */
export type UnidadArbol = Unidad & { hijos: UnidadArbol[] };

@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnidadDto) {
    await this.validarUnicidad(dto.nombre, dto.sigla);

    // El grupo lo elige la RAIZ; el hijo lo hereda del padre.
    let grupo: string;
    if (dto.padreId !== undefined && dto.padreId !== null) {
      const padre = await this.prisma.unidad.findUnique({
        where: { id: dto.padreId },
        select: { id: true, grupo: true },
      });
      if (!padre) {
        throw new BadRequestException(
          `No existe la unidad padre con id ${dto.padreId}`,
        );
      }
      grupo = padre.grupo ?? this.normalizarGrupo(dto.grupo);
    } else {
      grupo = this.normalizarGrupo(dto.grupo);
    }

    return this.prisma.unidad.create({
      data: {
        nombre: dto.nombre,
        sigla: dto.sigla,
        grupo,
        activo: dto.activo ?? true,
        padreId: dto.padreId ?? null,
      },
      include: { padre: true },
    });
  }

  /** Grupos existentes (distinct), para el selector al crear una unidad raiz. */
  async grupos(): Promise<string[]> {
    const filas = await this.prisma.unidad.findMany({
      where: { grupo: { not: null } },
      distinct: ['grupo'],
      select: { grupo: true },
      orderBy: { grupo: 'asc' },
    });
    return filas
      .map((f) => f.grupo)
      .filter((g): g is string => g != null && g !== '');
  }

  async findAll(query: QueryUnidadesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'unidades',
          ['nombre', 'sigla'],
          query.q,
        )
      : null;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.unidad.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { padre: true },
      }),
      this.prisma.unidad.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  /**
   * Arbol jerarquico completo (nodos raiz con sus hijos anidados).
   * Como la institucion tiene decenas de unidades (no miles), se arma en memoria.
   */
  async arbol(query: QueryArbolUnidadesDto): Promise<UnidadArbol[]> {
    const todas = await this.prisma.unidad.findMany({
      orderBy: [{ nombre: 'asc' }],
    });

    const porId = new Map<number, UnidadArbol>();
    for (const u of todas) {
      porId.set(u.id, { ...u, hijos: [] });
    }

    const raices: UnidadArbol[] = [];
    for (const u of todas) {
      const nodo = porId.get(u.id)!;
      if (u.padreId != null && porId.has(u.padreId)) {
        porId.get(u.padreId)!.hijos.push(nodo);
      } else {
        raices.push(nodo);
      }
    }

    if (query.soloActivas) {
      return this.podarInactivas(raices);
    }
    return raices;
  }

  async findOne(id: number) {
    const unidad = await this.prisma.unidad.findUnique({
      where: { id },
      include: { padre: true },
    });
    if (!unidad) {
      throw new NotFoundException(`No existe la unidad con id ${id}`);
    }
    return unidad;
  }

  async update(id: number, dto: UpdateUnidadDto) {
    const existente = await this.prisma.unidad.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`No existe la unidad con id ${id}`);
    }

    const nombre =
      dto.nombre !== undefined && dto.nombre !== existente.nombre
        ? dto.nombre
        : undefined;
    const sigla =
      dto.sigla !== undefined && dto.sigla !== existente.sigla
        ? dto.sigla
        : undefined;
    await this.validarUnicidad(nombre, sigla, id);

    // Validar cambio de padre.
    if (dto.padreId !== undefined) {
      // null = mover a raiz.
      if (dto.padreId !== null) {
        // Verificar que el padre existe.
        const padre = await this.prisma.unidad.findUnique({
          where: { id: dto.padreId },
          select: { id: true },
        });
        if (!padre) {
          throw new BadRequestException(
            `No existe la unidad padre con id ${dto.padreId}`,
          );
        }

        // Prevenir ciclos: no puedo ser mi propio ancestro.
        if (dto.padreId === id) {
          throw new BadRequestException(
            'Una unidad no puede ser su propio padre',
          );
        }

        // Verificar que el nuevo padre no sea un descendiente mio.
        const esDescendiente = await this.esDescendiente(dto.padreId, id);
        if (esDescendiente) {
          throw new BadRequestException(
            'No se puede mover una unidad a uno de sus propios descendientes (se crearia un ciclo)',
          );
        }
      }
    }

    return this.prisma.unidad.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.sigla !== undefined ? { sigla: dto.sigla } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.padreId !== undefined ? { padreId: dto.padreId } : {}),
      },
      include: { padre: true },
    });
  }

  /**
   * Baja logica (desactiva) en cascada: la unidad y todos sus descendientes.
   * No se borra para preservar la referencia de usuarios.
   */
  async remove(id: number) {
    const existente = await this.prisma.unidad.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe la unidad con id ${id}`);
    }

    if (existente.activo) {
      // Obtener todos los ids de descendientes para desactivar en cascada.
      const idsADesactivar = await this.obtenerDescendientes(id);
      idsADesactivar.push(id);

      await this.prisma.unidad.updateMany({
        where: { id: { in: idsADesactivar } },
        data: { activo: false },
      });
    }

    return this.findOne(id);
  }

  /** Normaliza el grupo a MAYUSCULAS y exige que venga (para unidades raiz). */
  private normalizarGrupo(grupo?: string): string {
    const limpio = grupo?.trim().toUpperCase();
    if (!limpio) {
      throw new BadRequestException(
        'El grupo es requerido para una unidad de primer nivel',
      );
    }
    return limpio;
  }

  /** Valida unicidad de nombre y sigla (excluyendo el propio id en updates). */
  private async validarUnicidad(
    nombre?: string,
    sigla?: string,
    excluirId?: number,
  ) {
    const excluir = excluirId ? { id: { not: excluirId } } : {};

    if (nombre !== undefined) {
      const existe = await this.prisma.unidad.findFirst({
        where: { nombre, ...excluir },
        select: { id: true },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe una unidad con el nombre "${nombre}"`,
        );
      }
    }

    if (sigla !== undefined) {
      const existe = await this.prisma.unidad.findFirst({
        where: { sigla, ...excluir },
        select: { id: true },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe una unidad con la sigla "${sigla}"`,
        );
      }
    }
  }

  /**
   * Verifica si `posibleDescendienteId` es descendiente de `ancestroId`.
   * Se usa para prevenir ciclos al cambiar padre.
   */
  private async esDescendiente(
    posibleDescendienteId: number,
    ancestroId: number,
  ): Promise<boolean> {
    const unidad = await this.prisma.unidad.findUnique({
      where: { id: posibleDescendienteId },
      select: { padreId: true },
    });
    if (!unidad || unidad.padreId === null) {
      return false;
    }
    if (unidad.padreId === ancestroId) {
      return true;
    }
    return this.esDescendiente(unidad.padreId, ancestroId);
  }

  /**
   * Obtiene los ids de todos los descendientes (hijos, nietos, etc.) de una unidad.
   * Se usa para la desactivacion en cascada.
   */
  private async obtenerDescendientes(unidadId: number): Promise<number[]> {
    const hijos = await this.prisma.unidad.findMany({
      where: { padreId: unidadId },
      select: { id: true },
    });

    const ids: number[] = [];
    for (const hijo of hijos) {
      ids.push(hijo.id);
      const descendientesHijo = await this.obtenerDescendientes(hijo.id);
      ids.push(...descendientesHijo);
    }
    return ids;
  }

  /**
   * Poda las ramas que no contienen ninguna unidad activa. Un nodo se conserva
   * si esta activo o si alguno de sus descendientes lo esta (ancestros de activos).
   */
  private podarInactivas(nodos: UnidadArbol[]): UnidadArbol[] {
    const resultado: UnidadArbol[] = [];
    for (const nodo of nodos) {
      const hijos = this.podarInactivas(nodo.hijos);
      if (nodo.activo || hijos.length > 0) {
        resultado.push({ ...nodo, hijos });
      }
    }
    return resultado;
  }
}
