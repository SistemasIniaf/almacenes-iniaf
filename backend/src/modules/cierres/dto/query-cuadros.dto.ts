import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Cuadros 5 y 6: de UN almacén, o institucionales sin `almacenId`. */
export class QueryCuadrosDto {
  @Type(() => Number)
  @IsInt({ message: 'Indicá la gestión' })
  @Min(2000)
  gestion!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  almacenId?: number;
}
