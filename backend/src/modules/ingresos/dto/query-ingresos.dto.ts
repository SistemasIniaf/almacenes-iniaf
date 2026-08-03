import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EstadoIngreso } from '../../../generated/prisma/enums';

/** Filtros y buscador del listado de ingresos (extiende la paginacion base). */
export class QueryIngresosDto extends PaginationQueryDto {
  /** Busca en proceso/C31, certificacion y observacion. */
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

  /**
   * Rango sobre la FECHA DE INGRESO (la de efecto contable), no sobre la de
   * remision: el reporte tiene que coincidir con lo que movio el Kardex. Ambos
   * extremos son INCLUSIVOS y se interpretan en UTC, igual que el kardex.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" no es valida' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" no es valida' })
  hasta?: string;
}
