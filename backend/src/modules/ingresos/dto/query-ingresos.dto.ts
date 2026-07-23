import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EstadoIngreso } from '../../../generated/prisma/enums';

/** Filtros y buscador del listado de ingresos (extiende la paginacion base). */
export class QueryIngresosDto extends PaginationQueryDto {
  /** Busca en nota de remision, proceso/C31 y Nº de factura. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(EstadoIngreso, { message: 'El estado no es valido' })
  estado?: EstadoIngreso;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;

  /** Solo tiene efecto para super_admin/admin (los demas ven su propio scope). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proveedorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fuenteFinanciamientoId?: number;
}
