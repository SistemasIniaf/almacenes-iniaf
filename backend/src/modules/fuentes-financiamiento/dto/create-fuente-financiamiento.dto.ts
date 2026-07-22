import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFuenteFinanciamientoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El codigo no puede estar vacio' })
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
