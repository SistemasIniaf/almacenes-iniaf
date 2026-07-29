import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';
import { EstadoEgreso } from '../../../generated/prisma/enums';

/** Filtros y buscador del listado de egresos. */
export class QueryEgresosDto extends PaginationQueryDto {
  /** Busca en la justificacion (el numero se filtra por gestion + estado). */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(EstadoEgreso, { message: 'El estado no es valido' })
  estado?: EstadoEgreso;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  unidadId?: number;

  /**
   * `true` = solo los que esperan una decision MIA. Es la bandeja de entrada:
   * al aprobador le trae los de su unidad pendientes de su firma y al
   * responsable, los de su almacen listos para entregar.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  pendientesMios?: boolean;
}
