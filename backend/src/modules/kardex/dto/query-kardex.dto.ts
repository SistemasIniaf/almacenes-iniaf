import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

/**
 * El kardex es el libro de UN item en UN almacen: el saldo corriente no tiene
 * sentido si se mezclan items o almacenes. Por eso `itemId` es obligatorio y el
 * almacen se resuelve (el responsable usa el suyo).
 */
export class QueryKardexDto {
  @Type(() => Number)
  @IsInt({ message: 'itemId es obligatorio' })
  @Min(1)
  itemId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  almacenId?: number;

  /** Gestion a mostrar. Por defecto, la del año en curso. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  gestion?: number;

  /**
   * Fuente de financiamiento. Opcional a proposito: el sistema anterior OBLIGA
   * a elegir una y no tiene vista consolidada; aca, sin filtro, el kardex sale
   * con todas las fuentes juntas.
   */
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
