import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { Rol } from '../../../generated/prisma/enums';

/**
 * Todos los campos opcionales. Enviar un campo con valor lo actualiza; omitirlo
 * lo deja igual. `password` solo se re-hashea si se envia.
 *
 * Se define explicito (no con PartialType) para evitar el problema de metadata
 * duplicada de class-validator bajo pnpm, que dejaba el DTO sin propiedades.
 */
export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  nombre?: string;

  @IsOptional()
  @IsString()
  cargo?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  usuario?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsEnum(Rol, { message: 'El rol no es valido' })
  rol?: Rol;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt({ message: 'unidadId debe ser un entero' })
  unidadId?: number | null;

  @IsOptional()
  @IsInt({ message: 'almacenId debe ser un entero' })
  almacenId?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada almacen observado debe ser un entero' })
  almacenesObservados?: number[];
}
