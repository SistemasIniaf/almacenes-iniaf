import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import {
  UPLOAD_PUBLIC_PREFIX,
  UPLOAD_ROOT,
} from './common/uploads/uploads.config';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Habilitar CORS
  app.enableCors();

  // Archivos subidos (imagenes de items): estaticos publicos bajo /uploads.
  // Quedan FUERA del prefijo global de la API y del JwtAuthGuard (decision
  // deliberada: fotos referenciales servibles con <img src>). El nombre de
  // archivo lleva sufijo aleatorio para que la ruta no sea adivinable.
  app.useStaticAssets(UPLOAD_ROOT, { prefix: UPLOAD_PUBLIC_PREFIX });

  // Prefijo global para la API
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Validación global de DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  console.log('');
  console.log('📦 ===============================================');
  console.log(`🚀 Servidor: http://localhost:${port}`);
  console.log(`📡 API: http://localhost:${port}/${apiPrefix}`);
  console.log(`🌍 Entorno: ${configService.get('NODE_ENV')}`);
  console.log('📦 ===============================================');
  console.log('');
}

void main();
