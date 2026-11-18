import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import {
  UPLOAD_PUBLIC_PREFIX,
  UPLOAD_ROOT,
} from './common/uploads/uploads.config';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  const produccion = configService.get<string>('NODE_ENV') === 'production';

  // Limite del JSON: 2 MB para todo (un traspaso de «todo el almacen» son
  // miles de lineas) y 20 MB SOLO para la importacion de saldos iniciales, que
  // manda la planilla entera. Antes eran 20 MB para todas las rutas, incluido
  // el login, que es publico: cualquiera podia hacer parsear cuerpos enormes.
  // El parser de la ruta va primero; el general no vuelve a leer el cuerpo.
  app.use(`/${apiPrefix}/saldos-iniciales`, json({ limit: '20mb' }));
  app.useBodyParser('json', { limit: '2mb' });

  // CORS: en desarrollo el frontend corre en otro puerto y lo necesita. En
  // produccion todo sale por el mismo origen (nginx), asi que queda APAGADO
  // salvo que se declare `CORS_ORIGIN` (uno o varios, separados por coma).
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()) });
  } else if (!produccion) {
    app.enableCors();
  }

  // Los secretos de ejemplo estan en el repo: con ellos cualquiera firma un
  // token valido. Se avisa fuerte en vez de impedir el arranque, para no
  // dejar caido un servidor que ya estaba andando.
  const logger = new Logger('Arranque');
  for (const clave of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secreto = configService.get<string>(clave) ?? '';
    if (produccion && (secreto.length < 24 || /cambiar/i.test(secreto))) {
      logger.warn(
        `${clave} es el valor de ejemplo o es muy corto: generá uno con «openssl rand -hex 32» y reiniciá.`,
      );
    }
  }

  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  // Archivos subidos (imagenes de items): estaticos publicos bajo /uploads.
  // Quedan FUERA del prefijo global de la API y del JwtAuthGuard (decision
  // deliberada: fotos referenciales servibles con <img src>). El nombre de
  // archivo lleva sufijo aleatorio para que la ruta no sea adivinable.
  app.useStaticAssets(UPLOAD_ROOT, { prefix: UPLOAD_PUBLIC_PREFIX });

  // Prefijo global para la API
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
