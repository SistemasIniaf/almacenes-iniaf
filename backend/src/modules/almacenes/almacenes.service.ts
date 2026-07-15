import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { QueryAlmacenesDto } from './dto/query-almacenes.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';

@Injectable()
export class AlmacenesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlmacenDto) {
    await this.validarUnicidad(dto.nombre);
    return this.prisma.almacen.create({
      data: {
        nombre: dto.nombre,
        activo: dto.activo ?? true,
      },
    });
  }

  async findAll(query: QueryAlmacenesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.q
        ? {
            nombre: { contains: query.q, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.almacen.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.almacen.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id } });
    if (!almacen) {
      throw new NotFoundException(`No existe el almacen con id ${id}`);
    }
    return almacen;
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

    return this.prisma.almacen.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  /** Baja logica (desactiva). No se borra para preservar la referencia de usuarios/stock. */
  async remove(id: number) {
    const existente = await this.prisma.almacen.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el almacen con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.almacen.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
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
}
