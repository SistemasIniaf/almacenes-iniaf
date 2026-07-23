import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFuenteFinanciamientoDto } from './dto/create-fuente-financiamiento.dto';
import { QueryFuentesFinanciamientoDto } from './dto/query-fuentes-financiamiento.dto';
import { UpdateFuenteFinanciamientoDto } from './dto/update-fuente-financiamiento.dto';

/** Convierte cadena vacia o solo espacios en null; recorta el resto. */
function normalizar(valor?: string): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

@Injectable()
export class FuentesFinanciamientoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFuenteFinanciamientoDto) {
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(nombre);

    return this.prisma.fuenteFinanciamiento.create({
      data: {
        nombre,
        codigo: normalizar(dto.codigo) ?? null,
        activo: dto.activo ?? true,
      },
    });
  }

  async findAll(query: QueryFuentesFinanciamientoDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'fuentes_financiamiento',
          ['nombre', 'codigo'],
          query.q,
        )
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
      this.prisma.fuenteFinanciamiento.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fuenteFinanciamiento.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const fuente = await this.prisma.fuenteFinanciamiento.findUnique({
      where: { id },
    });
    if (!fuente) {
      throw new NotFoundException(
        `No existe la fuente de financiamiento con id ${id}`,
      );
    }
    return fuente;
  }

  async update(id: number, dto: UpdateFuenteFinanciamientoDto) {
    const existente = await this.prisma.fuenteFinanciamiento.findUnique({
      where: { id },
    });
    if (!existente) {
      throw new NotFoundException(
        `No existe la fuente de financiamiento con id ${id}`,
      );
    }

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    if (nombre !== undefined && nombre !== existente.nombre) {
      await this.validarNombreUnico(nombre, id);
    }

    return this.prisma.fuenteFinanciamiento.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(dto.codigo !== undefined ? { codigo: normalizar(dto.codigo) } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  /** Baja logica (desactiva). No se borra para preservar la referencia de ingresos. */
  async remove(id: number) {
    const existente = await this.prisma.fuenteFinanciamiento.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(
        `No existe la fuente de financiamiento con id ${id}`,
      );
    }
    if (existente.activo) {
      await this.prisma.fuenteFinanciamiento.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
  }

  /**
   * Valida que el nombre no este repetido (excluyendo el propio id en updates).
   * El nombre es @unique en la BD; esto adelanta un 409 con mensaje claro antes
   * de que falle el indice.
   */
  private async validarNombreUnico(nombre: string, excluirId?: number) {
    const existe = await this.prisma.fuenteFinanciamiento.findFirst({
      where: { nombre, ...(excluirId ? { id: { not: excluirId } } : {}) },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(
        `Ya existe una fuente de financiamiento con el nombre "${nombre}"`,
      );
    }
  }
}
