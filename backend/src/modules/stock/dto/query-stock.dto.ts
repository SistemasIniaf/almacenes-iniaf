import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/dto/transforms';

/** Filtros de la consulta de stock. */
export class QueryStockDto extends PaginationQueryDto {
  /** Busca en codigo y descripcion del item. */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Solo lo respeta admin/super_admin: los demas ven su propio scope y pedir
   * otro almacen no puede ampliarlo.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacenId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fuenteFinanciamientoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;

  /**
   * Partida del item. Es la que agrupa el reporte oficial (el «estado de
   * almacenes» sale por fuente y, dentro, por partida).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId?: number;

  /**
   * Por defecto solo lo que tiene saldo. En `false` incluye los items agotados,
   * util para ver que hubo en el almacen aunque hoy este en cero.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  conSaldo?: boolean;
}
