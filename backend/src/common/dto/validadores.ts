import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  Matches,
  ValidateBy,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';

/**
 * Validadores compartidos (2026-11-18). Nacieron de una revision que encontro
 * entradas que terminaban en 500 en vez de 400: cada uno cierra un hueco que
 * los decoradores de class-validator dejan abierto.
 */

/**
 * Una fecha que EMPIEZA con `AAAA-MM-DD`. `@IsDateString` solo acepta tambien
 * `"2026"` o `"2026-W10"` (ISO 8601 validos), que despues `inicioDelDia`
 * convertia en una fecha invalida y Prisma reventaba.
 */
export function EsDia(message: string) {
  return applyDecorators(
    IsDateString({}, { message }),
    Matches(/^\d{4}-\d{2}-\d{2}/, { message }),
  );
}

/**
 * Numero finito con hasta `decimales` decimales y, si se pasa, un tope.
 *
 * Reemplaza a `@IsNumber({ maxDecimalPlaces })`, que con un valor en notacion
 * exponencial (`1e-7`) lanza un TypeError adentro de class-validator. El tope
 * es el de la columna: sin el, una cantidad gigante desbordaba el `Decimal` de
 * Postgres.
 */
export function EsDecimal(
  decimales: number,
  opciones: { max?: number } & ValidationOptions = {},
) {
  const { max, ...validationOptions } = opciones;
  const factor = 10 ** decimales;
  return ValidateBy(
    {
      name: 'esDecimal',
      validator: {
        validate: (valor: unknown) => {
          if (typeof valor !== 'number' || !Number.isFinite(valor)) {
            return false;
          }
          if (max !== undefined && Math.abs(valor) > max) return false;
          const escalado = valor * factor;
          // Tolerancia relativa: 33.33 * 100 no da 3333 exacto en binario.
          return (
            Math.abs(escalado - Math.round(escalado)) <
            1e-9 * Math.max(1, Math.abs(escalado))
          );
        },
        defaultMessage: () =>
          `Debe ser un numero con hasta ${decimales} decimales` +
          (max !== undefined ? ` y no mayor a ${max}` : ''),
      },
    },
    validationOptions,
  );
}

/** Topes de las columnas `Decimal(12,2)` y `Decimal(12,5)`. */
export const MAX_CANTIDAD = 9_999_999_999.99;
export const MAX_PRECIO = 9_999_999.99999;

/**
 * Como `@IsOptional()`, pero SOLO deja pasar `undefined`: un `null` sigue a los
 * demas validadores y sale como 400. `@IsOptional` tambien acepta `null`, y en
 * campos que el service trata como texto eso terminaba en `null.trim()`.
 */
export function OpcionalNoNulo() {
  return ValidateIf((_objeto, valor) => valor !== undefined);
}

/**
 * Recorta los espacios de un texto ANTES de validarlo, asi `"   "` no pasa un
 * `@IsNotEmpty` y se guarda vacio.
 */
export function Recortar() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
