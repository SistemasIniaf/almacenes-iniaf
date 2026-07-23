import { PrismaModule } from './prisma/prisma.module';

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';

import { AlmacenesModule } from './modules/almacenes/almacenes.module';
import { AuthModule } from './modules/auth/auth.module';
import { FuentesFinanciamientoModule } from './modules/fuentes-financiamiento/fuentes-financiamiento.module';
import { IngresosModule } from './modules/ingresos/ingresos.module';
import { ItemsModule } from './modules/items/items.module';
import { PartidasModule } from './modules/partidas/partidas.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { UnidadesModule } from './modules/unidades/unidades.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    UnidadesModule,
    AlmacenesModule,
    PartidasModule,
    ItemsModule,
    ProveedoresModule,
    FuentesFinanciamientoModule,
    IngresosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
