import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md). */
export class UpdateProveedorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  @MaxLength(200)
  nombre?: string;

  /** Enviar cadena vacia para limpiar el NIT (se normaliza a null). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
