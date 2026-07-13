import { TransformFnParams } from 'class-transformer';

/**
 * Convierte un valor de query string a booleano de forma robusta.
 * Acepta true/false reales y los strings "true"/"false"/"1"/"0".
 * Cualquier otra cosa se deja pasar para que @IsBoolean la rechace.
 */
export function toBoolean({ value }: TransformFnParams): unknown {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}
