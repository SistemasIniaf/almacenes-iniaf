import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsJWT({ message: 'El refresh token no es valido' })
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;
}
