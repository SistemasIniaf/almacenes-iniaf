import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** La contraseña inicial sigue la misma regla que cualquier contraseña (mínimo 6). */
export class ClaveInicialDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña inicial es requerida' })
  @MinLength(6, {
    message: 'La contraseña inicial debe tener al menos 6 caracteres',
  })
  claveInicial!: string;
}
