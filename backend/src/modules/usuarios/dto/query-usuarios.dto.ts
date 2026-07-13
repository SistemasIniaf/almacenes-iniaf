import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';
import { Rol } from '../../../generated/prisma/enums';

/** Filtros y buscador del listado de usuarios (extiende la paginacion base). */
export class QueryUsuariosDto extends PaginationQueryDto {
  /** Busca en nombre y usuario (username). */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(Rol, { message: 'El rol no es valido' })
  rol?: Rol;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  unidadId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;
}
