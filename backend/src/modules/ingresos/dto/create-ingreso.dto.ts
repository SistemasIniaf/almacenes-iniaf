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
 * Crea un Ingreso en estado BORRADOR. Casi todo es opcional: un borrador puede
 * guardarse incompleto (incluso sin ítems) y completarse despues. Las
 * validaciones "duras" (respaldos obligatorios, >=1 ítem) rigen al CONFIRMAR.
 */
export class CreateIngresoDto {
  /**
   * Solo lo mandan super_admin/admin (eligen a que almacen entra). El
   * responsable_almacen usa siempre SU almacen (se ignora lo que mande).
   */
  @IsOptional()
  @IsInt({ message: 'almacenId debe ser un entero' })
  almacenId?: number;

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
  proveedorId?: number;

  @IsOptional()
  @IsInt()
  fuenteFinanciamientoId?: number;

  @IsOptional()
  @IsInt()
  responsableConformidadId?: number;

  @IsOptional()
  @IsInt()
  unidadSolicitanteId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngresoDetalleDto)
  detalles?: IngresoDetalleDto[];
}
