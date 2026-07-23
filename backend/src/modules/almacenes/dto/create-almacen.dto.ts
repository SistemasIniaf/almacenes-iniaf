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

export class CreateAlmacenDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /**
   * Unidades (del catálogo compartido) que este almacén muestra en el selector
   * de "unidad solicitante" del Ingreso. Muchos-a-muchos; se pueden repetir
   * entre almacenes (ej. varios departamentales comparten los mismos rubros).
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada unidad debe ser un id valido' })
  unidadIds?: number[];
}
