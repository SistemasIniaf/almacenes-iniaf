import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Una linea del pedido. Apunta al LOTE (`ingresoDetalleId`), no al item: el
 * solicitante elige de que compra y de que fuente sale el material (decision del
 * encargado, 2026-07-29). El item, la fuente y el precio se derivan del lote.
 */
export class EgresoDetalleDto {
  @IsInt({ message: 'Cada linea debe apuntar a un lote' })
  ingresoDetalleId!: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La cantidad admite hasta 2 decimales' },
  )
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  cantidadSolicitada!: number;
}

/**
 * Alta del pedido, siempre como BORRADOR. El almacen y la unidad NO se envian:
 * se heredan del solicitante (ver "Regla de negocio critica" en CLAUDE.md).
 */
export class CreateEgresoDto {
  @IsString()
  @IsNotEmpty({ message: 'La justificacion es requerida' })
  @MaxLength(300, {
    message: 'La justificacion no puede superar los 300 caracteres',
  })
  justificacion!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => EgresoDetalleDto)
  detalles!: EgresoDetalleDto[];
}
