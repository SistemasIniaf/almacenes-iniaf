import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';

/** Filtros y buscador del listado de items (extiende la paginacion base). */
export class QueryItemsDto extends PaginationQueryDto {
  /** Busca en codigo y descripcion. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId?: number;

  /** Orden del listado. Default = por fecha; `descripcion`/`codigo` = alfabetico. */
  @IsOptional()
  @IsIn(['descripcion', 'codigo'])
  orden?: 'descripcion' | 'codigo';
}
