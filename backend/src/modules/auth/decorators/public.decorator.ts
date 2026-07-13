import { SetMetadata } from '@nestjs/common';

/** Marca un endpoint como publico (sin access token). Ej: login, refresh. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
