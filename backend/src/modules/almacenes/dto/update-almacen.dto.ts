import { OpcionalNoNulo, Recortar } from '../../../common/dto/validadores';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md). */
export class UpdateAlmacenDto {
  @OpcionalNoNulo()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  @MaxLength(150)
  nombre?: string;

  @OpcionalNoNulo()
  @IsBoolean()
  activo?: boolean;

  /** Reemplaza el conjunto de unidades del almacén (si se envía). */
  @OpcionalNoNulo()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada unidad debe ser un id valido' })
  unidadIds?: number[];
}
