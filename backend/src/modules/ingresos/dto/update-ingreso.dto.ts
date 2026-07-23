import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { IngresoDetalleDto } from './ingreso-detalle.dto';

/**
 * Edita un Ingreso en BORRADOR (el service lo rechaza si ya esta CONFIRMADO).
 * El almacen NO se cambia. Si `detalles` viene, reemplaza el conjunto de lineas.
 */
export class UpdateIngresoDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de remision no es valida' })
  fechaRemision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  notaRemision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  procesoC31?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  certificacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  informeConformidad?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha del informe/acta no es valida' })
  fechaInformeConformidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroFactura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsOptional()
  @IsInt()
  proveedorId?: number | null;

  @IsOptional()
  @IsInt()
  fuenteFinanciamientoId?: number | null;

  @IsOptional()
  @IsInt()
  responsableConformidadId?: number | null;

  @IsOptional()
  @IsInt()
  unidadSolicitanteId?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngresoDetalleDto)
  detalles?: IngresoDetalleDto[];
}
