import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';

/** Filtros y buscador del listado de fuentes (extiende la paginacion base). */
export class QueryFuentesFinanciamientoDto extends PaginationQueryDto {
  /** Busca en nombre y codigo. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;

  /** Orden del listado. `nombre` = alfabetico (selectores); default = por fecha. */
  @IsOptional()
  @IsIn(['nombre'])
  orden?: 'nombre';
}
