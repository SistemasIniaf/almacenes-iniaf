import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Edita SOLO la cabecera documental de un ingreso ya registrado. A propósito NO
 * lleva `detalles`, `almacenId`, `fuenteFinanciamientoId` ni `fechaRemision`:
 * esos tocan stock / valorización / correlativo, y para corregirlos se anula el
 * ingreso y se vuelve a registrar. El service rechaza editar uno anulado.
 */
export class UpdateIngresoDto {
  /**
   * Correccion de la fecha con efecto contable. SOLO super_admin (lo valida el
   * service, que es quien conoce al usuario). El caso previsto es el cierre de
   * gestion: material que entro el 28/12 y se registro el 2/1. Si la correccion
   * cae en otra gestion, el service re-estampa el correlativo.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de ingreso no es valida' })
  fechaIngreso?: string;

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
  responsableConformidadId?: number | null;

  @IsOptional()
  @IsInt()
  unidadSolicitanteId?: number | null;
}
