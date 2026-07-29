import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { EgresoDetalleDto } from './create-egreso.dto';

/**
 * Edicion del BORRADOR, y solo del borrador: una vez enviado, el pedido entro al
 * circuito de otro y el solicitante no lo toca mas. Si mandan `detalles`,
 * REEMPLAZA la lista completa (es como se comporta el formulario).
 */
export class UpdateEgresoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La justificacion no puede estar vacia' })
  @MaxLength(300)
  justificacion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => EgresoDetalleDto)
  detalles?: EgresoDetalleDto[];
}
