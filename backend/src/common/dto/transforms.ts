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

/**
 * Convierte `?campo=A,B` (o `?campo=A`) en un array de strings.
 *
 * Deja pasar cualquier otra cosa para que el validador de arriba la rechace con
 * su propio mensaje: este transform normaliza la FORMA, no valida el contenido.
 * Un solo valor sigue funcionando, asi que agregarlo a un filtro que ya existia
 * no rompe a quien lo mandaba suelto.
 */
export function toStringArray({ value }: TransformFnParams): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const partes = value
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
  return partes.length > 0 ? partes : undefined;
}
