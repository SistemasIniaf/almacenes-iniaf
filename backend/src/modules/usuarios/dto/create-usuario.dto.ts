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
 * Campos base de un usuario. Las reglas de qué campos son requeridos/prohibidos
 * segun el rol (unidad, almacen, almacenes observados) se validan en el service,
 * porque dependen del valor de `rol` y no se expresan bien con class-validator.
 */
export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El usuario (username) es requerido' })
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  usuario!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contrasena es requerida' })
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password!: string;

  @IsEnum(Rol, { message: 'El rol no es valido' })
  rol!: Rol;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Requerido para solicitador/aprobador; prohibido para el resto (validado en el service).
  @IsOptional()
  @IsInt({ message: 'unidadId debe ser un entero' })
  unidadId?: number | null;

  // Requerido para solicitador/aprobador/responsable_almacen/central; prohibido para el resto.
  @IsOptional()
  @IsInt({ message: 'almacenId debe ser un entero' })
  almacenId?: number | null;

  // Solo para observador_almacen (relacion muchos-a-muchos).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada almacen observado debe ser un entero' })
  almacenesObservados?: number[];
}
