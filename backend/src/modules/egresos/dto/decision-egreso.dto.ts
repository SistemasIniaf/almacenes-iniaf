import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Motivo de un RECHAZO o de una ANULACION. Obligatorio en los dos casos: sin el
 * motivo, el historial dice que alguien rechazo pero no por que, y el
 * solicitante no sabe que corregir.
 */
export class MotivoDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MaxLength(300)
  motivo!: string;
}
