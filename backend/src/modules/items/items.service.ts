import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/** Ancho del correlativo en el codigo del item (ej. "39700-000001"). */
const CORRELATIVO_PADDING = 6;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el item y autogenera su codigo `{partida.codigo}-{correlativo}`.
   * Todo ocurre en una transaccion: el `increment` sobre `ultimoCorrelativo` toma
   * un lock de fila, por lo que dos creaciones simultaneas sobre la misma partida
   * se serializan y nunca reciben el mismo correlativo.
   */
  async create(dto: CreateItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const partida = await tx.partida.findUnique({
        where: { id: dto.partidaId },
        select: {
          id: true,
          codigo: true,
          activo: true,
          seleccionable: true,
        },
      });

      if (!partida) {
        throw new NotFoundException(
          `No existe la partida con id ${dto.partidaId}`,
        );
      }
      // Solo los nodos hoja del clasificador admiten items (ver CLAUDE.md).
      if (!partida.seleccionable) {
        throw new BadRequestException(
          `La partida ${partida.codigo} no es seleccionable: solo se pueden asignar items a partidas de ultimo nivel`,
        );
      }
      if (!partida.activo) {
        throw new BadRequestException(
          `La partida ${partida.codigo} esta inactiva`,
        );
      }

      const { ultimoCorrelativo } = await tx.partida.update({
        where: { id: partida.id },
        data: { ultimoCorrelativo: { increment: 1 } },
        select: { ultimoCorrelativo: true },
      });

      const codigo = `${partida.codigo}-${String(ultimoCorrelativo).padStart(
        CORRELATIVO_PADDING,
        '0',
      )}`;

      return tx.item.create({
        data: {
          codigo,
          descripcion: dto.descripcion,
          unidadMedida: dto.unidadMedida,
          activo: dto.activo ?? true,
          partidaId: partida.id,
        },
      });
    });
  }

  async findAll(query: QueryItemsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.partidaId !== undefined ? { partidaId: query.partidaId } : {}),
      ...(query.q
        ? {
            OR: [
              { codigo: { contains: query.q, mode: 'insensitive' as const } },
              {
                descripcion: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          partida: { select: { id: true, codigo: true, denominacion: true } },
        },
        orderBy: { codigo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        partida: { select: { id: true, codigo: true, denominacion: true } },
      },
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    return item;
  }

  /** No se puede cambiar el codigo ni la partida (ver UpdateItemDto). */
  async update(id: number, dto: UpdateItemDto) {
    const existente = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }

    await this.prisma.item.update({
      where: { id },
      data: {
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion }
          : {}),
        ...(dto.unidadMedida !== undefined
          ? { unidadMedida: dto.unidadMedida }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return this.findOne(id);
  }

  /** Baja logica (desactiva). No se borra para preservar el historial de movimientos. */
  async remove(id: number) {
    const existente = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.item.update({ where: { id }, data: { activo: false } });
    }
    return this.findOne(id);
  }
}
