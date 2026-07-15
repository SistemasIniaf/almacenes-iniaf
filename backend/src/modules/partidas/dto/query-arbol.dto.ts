import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { toBoolean } from '../../../common/dto/transforms';

/** Opciones del arbol jerarquico completo de partidas. */
export class QueryArbolDto {
  /**
   * Si es true, poda las ramas sin ninguna partida activa (conservando los
   * ancestros de nodos activos). Por defecto devuelve el arbol completo.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  soloActivas?: boolean;
}
