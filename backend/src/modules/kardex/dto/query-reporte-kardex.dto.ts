import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Filtros del reporte de kardex.
 *
 * A diferencia del kardex de PANTALLA, el `itemId` NO es obligatorio: el
 * reporte sale de TODOS los items del almacen, un bloque por cada uno (asi lo
 * emitia el sistema anterior). Si viene, se acota a ese item.
 */
export class QueryReporteKardexDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacenId?: number;

  /** Gestion del reporte. Por defecto, la del año en curso. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  gestion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fuenteFinanciamientoId?: number;

  /**
   * Rango de fechas del libro. Ambos extremos INCLUSIVOS, en UTC.
   *
   * Con rango, el saldo de apertura pasa a ser el de `desde` (un extracto de
   * marzo abre con el saldo al 1/3, no con el de enero). Sin rango, la ventana
   * es la gestion entera.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" no es valida' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" no es valida' })
  hasta?: string;
}
