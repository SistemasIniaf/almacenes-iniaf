import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUnidadDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150)
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'La sigla es requerida' })
  @MaxLength(20)
  sigla!: string;

  /**
   * Grupo (MOF, OTROS...). Obligatorio para una unidad RAIZ; en un hijo se
   * ignora (hereda el del padre). Lo valida el service. Se guarda en MAYUSCULAS.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grupo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Id de la unidad padre. null/omitido = raiz (Oficina Inicial). */
  @IsOptional()
  @IsInt({ message: 'El padre debe ser un id de unidad valido' })
  padreId?: number;
}
