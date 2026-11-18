import {
  EsDecimal,
  EsDia,
  MAX_CANTIDAD,
  MAX_PRECIO,
} from '../../../common/dto/validadores';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Un lote de la planilla de migracion (`tools/migracion-saldos/`), ya con la
 * correspondencia resuelta por el frontend: almacen, fuente e item vienen por
 * su NOMBRE/CODIGO en el sistema nuevo, tal como los escribio la persona en la
 * planilla. Los resuelve el service — si no existen, es un error de esa fila,
 * no un 400 de todo el pedido.
 */
export class FilaSaldoDto {
  /** `IDINGRESOITEM` del sistema anterior: impide importar dos veces el lote. */
  @IsInt()
  loteAnteriorId!: number;

  /** `IDINGRESOALMACEN`: agrupa los lotes en el documento que los porta. */
  @IsInt()
  ingresoAnteriorId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  almacen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fuente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCodigo?: string;

  @EsDecimal(2, {
    max: MAX_CANTIDAD,
    message: 'La cantidad admite hasta 2 decimales (maximo 9.999.999.999,99)',
  })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @EsDecimal(5, {
    max: MAX_PRECIO,
    message: 'El precio admite hasta 5 decimales (maximo 9.999.999,99999)',
  })
  @Min(0, { message: 'El precio no puede ser negativo' })
  precioUnitario!: number;

  // --- Datos del documento de origen (se copian como respaldo) -------------
  @IsOptional() @IsString() @MaxLength(500) observacion?: string;
  @IsOptional() @IsString() @MaxLength(30) numeroAnterior?: string;
  @IsOptional() @IsString() @MaxLength(30) fechaAnterior?: string;
  @IsOptional() @IsString() @MaxLength(200) almacenAnterior?: string;
  @IsOptional() @IsString() @MaxLength(200) proveedor?: string;
  @IsOptional() @IsString() @MaxLength(50) nit?: string;
  @IsOptional() @IsString() @MaxLength(50) factura?: string;
  @IsOptional() @IsString() @MaxLength(50) procesoC31?: string;
  @IsOptional() @IsString() @MaxLength(50) certificacion?: string;
  @IsOptional() @IsString() @MaxLength(50) notaRemision?: string;
}

export class ImportarSaldosDto {
  /**
   * Los saldos son AL cierre de este dia (hora de Bolivia): el lote queda
   * fechado en su ultimo instante, asi la gestion siguiente lo ve como saldo
   * de apertura. Ej.: `2026-12-31` → saldo inicial de la gestion 2027.
   */
  @EsDia('La fecha de corte no es válida')
  fechaCorte!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La planilla no tiene lotes' })
  @ArrayMaxSize(20000, { message: 'Demasiadas filas en un solo envío' })
  @ValidateNested({ each: true })
  @Type(() => FilaSaldoDto)
  filas!: FilaSaldoDto[];
}
