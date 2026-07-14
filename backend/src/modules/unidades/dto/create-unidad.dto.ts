import {
  IsBoolean,
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

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
