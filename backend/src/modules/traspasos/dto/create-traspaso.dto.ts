import {
  EsDecimal,
  MAX_CANTIDAD,
  Recortar,
} from '../../../common/dto/validadores';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Una linea del traspaso: de que lote sale y cuanto. */
export class TraspasoDetalleDto {
  @IsInt({ message: 'ingresoDetalleId debe ser un entero' })
  ingresoDetalleId!: number;

  @EsDecimal(2, {
    max: MAX_CANTIDAD,
    message: 'La cantidad admite hasta 2 decimales (maximo 9.999.999.999,99)',
  })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;
}

export class CreateTraspasoDto {
  @IsInt({ message: 'Elegí el almacén de origen' })
  almacenOrigenId!: number;

  @IsInt({ message: 'Elegí el almacén de destino' })
  almacenDestinoId!: number;

  /** Por que se traspasa (ej. «CIERRE DEL ALMACÉN ORURO»). */
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'Escribí el motivo del traspaso' })
  @MaxLength(300, { message: 'El motivo admite hasta 300 caracteres' })
  observacion!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Elegí al menos un lote para traspasar' })
  @ValidateNested({ each: true })
  @Type(() => TraspasoDetalleDto)
  detalles!: TraspasoDetalleDto[];
}
