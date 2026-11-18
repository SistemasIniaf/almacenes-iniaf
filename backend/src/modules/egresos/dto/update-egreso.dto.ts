import { OpcionalNoNulo, Recortar } from '../../../common/dto/validadores';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { EgresoDetalleDto } from './create-egreso.dto';

/**
 * Edicion del BORRADOR o del DEVUELTO, y solo de esos: una vez enviado, el pedido entro al
 * circuito de otro y el solicitante no lo toca mas. Si mandan `detalles`,
 * REEMPLAZA la lista completa (es como se comporta el formulario).
 */
export class UpdateEgresoDto {
  @OpcionalNoNulo()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'La justificacion no puede estar vacia' })
  @MaxLength(300)
  justificacion?: string;

  @OpcionalNoNulo()
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => EgresoDetalleDto)
  detalles?: EgresoDetalleDto[];
}
