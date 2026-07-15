import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';

/** Filtros y buscador del listado plano de partidas (extiende la paginacion base). */
export class QueryPartidasDto extends PaginationQueryDto {
  /** Busca en codigo y denominacion. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;

  /** Solo hojas asignables a un Item (seleccionable=true). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  seleccionable?: boolean;

  /** Filtra por nivel de la jerarquia (1 = Grupo ... 5 = Sub-subpartida). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nivel?: number;

  /** Hijos directos de esta partida. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  padreId?: number;
}
