import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El usuario es requerido' })
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'La contrasena es requerida' })
  password: string;
}
