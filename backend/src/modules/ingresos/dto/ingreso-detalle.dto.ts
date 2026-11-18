import {
  EsDecimal,
  MAX_CANTIDAD,
  MAX_PRECIO,
} from '../../../common/dto/validadores';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Una linea del ingreso (item + cantidad + precio). Al confirmar se vuelve un lote. */
export class IngresoDetalleDto {
  @IsInt({ message: 'itemId debe ser un entero' })
  itemId!: number;

  @EsDecimal(2, {
    max: MAX_CANTIDAD,
    message: 'La cantidad admite hasta 2 decimales (maximo 9.999.999.999,99)',
  })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @EsDecimal(5, {
    max: MAX_PRECIO,
    message:
      'El precio unitario admite hasta 5 decimales (maximo 9.999.999,99999)',
  })
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  precioUnitario!: number;

  /** Nota libre por linea (ej. "COLOR NEGRO"). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La observacion admite hasta 200 caracteres' })
  observacion?: string;
}
