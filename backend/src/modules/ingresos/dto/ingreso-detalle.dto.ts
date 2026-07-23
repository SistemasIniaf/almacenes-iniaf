import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

/** Una linea del ingreso (item + cantidad + precio). Al confirmar se vuelve un lote. */
export class IngresoDetalleDto {
  @IsInt({ message: 'itemId debe ser un entero' })
  itemId!: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La cantidad admite hasta 2 decimales' },
  )
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio unitario admite hasta 5 decimales' },
  )
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  precioUnitario!: number;
}
