import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean, toStringArray } from '../../../common/dto/transforms';
import { EstadoEgreso } from '../../../generated/prisma/enums';

/** Filtros y buscador del listado de egresos. */
export class QueryEgresosDto extends PaginationQueryDto {
  /** Busca en la justificacion (el numero se filtra por gestion + estado). */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Uno o VARIOS estados, separados por coma (`?estado=ENTREGADO,ANULADO`).
   *
   * Admite varios porque el reporte necesita justo un par: los estados que
   * MOVIERON stock. Mandar uno solo sigue funcionando igual que antes.
   */
  @IsOptional()
  @Transform(toStringArray)
  @IsEnum(EstadoEgreso, { each: true, message: 'El estado no es valido' })
  estado?: EstadoEgreso[];

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

  /**
   * Rango sobre la fecha que muestra el listado: la de ENVIO y, mientras es
   * borrador, la de creacion. Ambos extremos inclusivos, en UTC.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" no es valida' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" no es valida' })
  hasta?: string;
}
