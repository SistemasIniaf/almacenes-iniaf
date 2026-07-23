import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md). */
export class UpdateAlmacenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Reemplaza el conjunto de unidades del almacén (si se envía). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada unidad debe ser un id valido' })
  unidadIds?: number[];
}
