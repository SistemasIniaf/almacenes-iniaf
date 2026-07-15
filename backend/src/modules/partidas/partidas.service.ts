import { Injectable, NotFoundException } from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { PrismaService } from '../../prisma/prisma.service';
import { Partida } from '../../generated/prisma/client';
import { QueryArbolDto } from './dto/query-arbol.dto';
import { QueryPartidasDto } from './dto/query-partidas.dto';

/** Nodo del arbol jerarquico: la partida mas sus hijos anidados. */
export type PartidaArbol = Partida & { hijos: PartidaArbol[] };

@Injectable()
export class PartidasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado plano paginado, con filtros y buscador. */
  async findAll(query: QueryPartidasDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.seleccionable !== undefined
        ? { seleccionable: query.seleccionable }
        : {}),
      ...(query.nivel !== undefined ? { nivel: query.nivel } : {}),
      ...(query.padreId !== undefined ? { padreId: query.padreId } : {}),
      ...(query.q
        ? {
            OR: [
              { codigo: { contains: query.q, mode: 'insensitive' as const } },
              {
                denominacion: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.partida.findMany({
        where,
        orderBy: { codigo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.partida.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  /**
   * Arbol jerarquico completo (nodos raiz con sus hijos anidados), ordenado por codigo.
   * Como el catalogo es acotado (solo grupos 20000 y 30000) se arma en memoria.
   */
  async arbol(query: QueryArbolDto): Promise<PartidaArbol[]> {
    const todas = await this.prisma.partida.findMany({
      orderBy: { codigo: 'asc' },
    });

    const porId = new Map<number, PartidaArbol>();
    for (const p of todas) {
      porId.set(p.id, { ...p, hijos: [] });
    }

    const raices: PartidaArbol[] = [];
    for (const p of todas) {
      const nodo = porId.get(p.id)!;
      if (p.padreId != null && porId.has(p.padreId)) {
        porId.get(p.padreId)!.hijos.push(nodo);
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
    const partida = await this.prisma.partida.findUnique({ where: { id } });
    if (!partida) {
      throw new NotFoundException(`No existe la partida con id ${id}`);
    }
    return partida;
  }

  async activar(id: number) {
    return this.setActivo(id, true);
  }

  async desactivar(id: number) {
    return this.setActivo(id, false);
  }

  /**
   * Activa/desactiva una sola partida (baja/alta logica). No hay cascada a hijos:
   * cada nodo se gestiona por separado. Las partidas no se crean ni borran (vienen del seed).
   */
  private async setActivo(id: number, activo: boolean) {
    const existente = await this.prisma.partida.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe la partida con id ${id}`);
    }
    if (existente.activo !== activo) {
      await this.prisma.partida.update({ where: { id }, data: { activo } });
    }
    return this.findOne(id);
  }

  /**
   * Poda las ramas que no contienen ninguna partida activa. Un nodo se conserva
   * si esta activo o si alguno de sus descendientes lo esta (ancestros de activos).
   */
  private podarInactivas(nodos: PartidaArbol[]): PartidaArbol[] {
    const resultado: PartidaArbol[] = [];
    for (const nodo of nodos) {
      const hijos = this.podarInactivas(nodo.hijos);
      if (nodo.activo || hijos.length > 0) {
        resultado.push({ ...nodo, hijos });
      }
    }
    return resultado;
  }
}
