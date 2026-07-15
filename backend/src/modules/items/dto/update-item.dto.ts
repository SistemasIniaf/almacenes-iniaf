import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md).
 * No se puede cambiar `codigo` (autogenerado) ni `partidaId`: el codigo deriva de
 * la partida, mover el item a otra partida dejaria un codigo inconsistente.
 */
export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripcion no puede estar vacia' })
  @MaxLength(300)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La unidad de medida no puede estar vacia' })
  @MaxLength(50)
  unidadMedida?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
