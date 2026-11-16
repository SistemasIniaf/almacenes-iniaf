import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryCierresDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;
}
