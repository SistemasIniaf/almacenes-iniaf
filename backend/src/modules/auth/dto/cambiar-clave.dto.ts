import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Cambio de la PROPIA contraseña. La nueva sigue la misma regla que al crear
 * el usuario (`CreateUsuarioDto`); la actual solo se exige no vacia — como en el
 * login, una regla de composicion ahi bloquearia contraseñas viejas validas.
 */
export class CambiarClaveDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  actual!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña nueva es requerida' })
  @MinLength(6, {
    message: 'La contraseña nueva debe tener al menos 6 caracteres',
  })
  nueva!: string;
}
