import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryTraspasosDto extends PaginationQueryDto {
  /** Traspasos que SALEN de este almacen o que LLEGAN a el. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;
}

export class QueryLotesTraspasoDto {
  @Type(() => Number)
  @IsInt({ message: 'Elegí el almacén de origen' })
  almacenId!: number;
}
