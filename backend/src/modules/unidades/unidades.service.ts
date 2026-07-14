import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUnidadDto } from './dto/create-unidad.dto';
import { QueryUnidadesDto } from './dto/query-unidades.dto';
import { UpdateUnidadDto } from './dto/update-unidad.dto';

@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnidadDto) {
    await this.validarUnicidad(dto.nombre, dto.sigla);
    return this.prisma.unidad.create({
      data: {
        nombre: dto.nombre,
        sigla: dto.sigla,
        activo: dto.activo ?? true,
      },
    });
  }

  async findAll(query: QueryUnidadesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.q
        ? {
            OR: [
              { nombre: { contains: query.q, mode: 'insensitive' as const } },
              { sigla: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.unidad.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.unidad.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
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

    return this.prisma.unidad.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.sigla !== undefined ? { sigla: dto.sigla } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  /** Baja logica (desactiva). No se borra para preservar la referencia de usuarios. */
  async remove(id: number) {
    const existente = await this.prisma.unidad.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe la unidad con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.unidad.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
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
}
