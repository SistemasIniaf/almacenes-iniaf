import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client';
import { Rol } from '../src/generated/prisma/enums';

/**
 * Seed de DESARROLLO (datos de prueba). NO usar en produccion.
 *
 * Crea unidades, almacenes y usuarios cubriendo todos los roles, respetando las
 * reglas de unicidad (un aprobador activo por unidad; un responsable_almacen y
 * un central activos por almacen). Es idempotente (upsert por nombre/username).
 *
 * Ejecutar: pnpm seed:dev
 * Todos los usuarios de prueba comparten la clave SEED_DEV_PASSWORD (def. "password123").
 */

const PASSWORD = process.env.SEED_DEV_PASSWORD ?? 'password123';

const unidades = [
  { nombre: 'Unidad de Planificación', sigla: 'UP' },
  { nombre: 'Unidad Administrativa Financiera', sigla: 'UAF' },
  { nombre: 'Unidad de Recursos Humanos', sigla: 'URH' },
  { nombre: 'Unidad Jurídica', sigla: 'UJ' },
];

const almacenes = [
  { nombre: 'Almacén Central' },
  { nombre: 'Almacén de Suministros' },
  { nombre: 'Almacén de Materiales' },
  { nombre: 'Almacén Regional' },
];

interface UsuarioDev {
  usuario: string;
  nombre: string;
  rol: Rol;
  unidad?: string; // sigla
  almacen?: string; // nombre
  observados?: string[]; // nombres de almacen
}

const usuarios: UsuarioDev[] = [
  { usuario: 'admin2', nombre: 'Admin Secundario', rol: Rol.admin },

  // Un aprobador activo por unidad.
  { usuario: 'aprob_up', nombre: 'Aprobador Planificación', rol: Rol.aprobador, unidad: 'UP' },
  { usuario: 'aprob_uaf', nombre: 'Aprobador Administrativo', rol: Rol.aprobador, unidad: 'UAF' },
  { usuario: 'aprob_urh', nombre: 'Aprobador RR.HH.', rol: Rol.aprobador, unidad: 'URH' },
  { usuario: 'aprob_uj', nombre: 'Aprobador Jurídico', rol: Rol.aprobador, unidad: 'UJ' },

  // Solicitadores (requieren unidad + almacen). Varios por unidad permitido.
  { usuario: 'solic_up1', nombre: 'Solicitador Planificación 1', rol: Rol.solicitador, unidad: 'UP', almacen: 'Almacén Central' },
  { usuario: 'solic_up2', nombre: 'Solicitador Planificación 2', rol: Rol.solicitador, unidad: 'UP', almacen: 'Almacén de Suministros' },
  { usuario: 'solic_uaf1', nombre: 'Solicitador Administrativo 1', rol: Rol.solicitador, unidad: 'UAF', almacen: 'Almacén Central' },
  { usuario: 'solic_urh1', nombre: 'Solicitador RR.HH. 1', rol: Rol.solicitador, unidad: 'URH', almacen: 'Almacén de Materiales' },

  // Un responsable_almacen activo por almacen.
  { usuario: 'resp_central', nombre: 'Responsable Almacén Central', rol: Rol.responsable_almacen, almacen: 'Almacén Central' },
  { usuario: 'resp_suministros', nombre: 'Responsable Suministros', rol: Rol.responsable_almacen, almacen: 'Almacén de Suministros' },
  { usuario: 'resp_materiales', nombre: 'Responsable Materiales', rol: Rol.responsable_almacen, almacen: 'Almacén de Materiales' },
  { usuario: 'resp_regional', nombre: 'Responsable Regional', rol: Rol.responsable_almacen, almacen: 'Almacén Regional' },

  // Un central activo por almacen (mismo patron que responsable).
  { usuario: 'central_central', nombre: 'Central Almacén Central', rol: Rol.central, almacen: 'Almacén Central' },
  { usuario: 'central_suministros', nombre: 'Central Suministros', rol: Rol.central, almacen: 'Almacén de Suministros' },
  { usuario: 'central_materiales', nombre: 'Central Materiales', rol: Rol.central, almacen: 'Almacén de Materiales' },
  { usuario: 'central_regional', nombre: 'Central Regional', rol: Rol.central, almacen: 'Almacén Regional' },

  // Observadores (sin almacen fijo; ven varios via tabla intermedia).
  {
    usuario: 'obs_auditor',
    nombre: 'Observador Auditor',
    rol: Rol.observador_almacen,
    observados: ['Almacén Central', 'Almacén de Suministros', 'Almacén de Materiales', 'Almacén Regional'],
  },
  {
    usuario: 'obs_control',
    nombre: 'Observador Control Interno',
    rol: Rol.observador_almacen,
    observados: ['Almacén Central', 'Almacén Regional'],
  },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-dev NO debe ejecutarse en produccion.');
  }

  const password = await bcrypt.hash(PASSWORD, 10);

  // Unidades y almacenes (upsert por nombre unico).
  const unidadPorSigla = new Map<string, number>();
  for (const u of unidades) {
    const row = await prisma.unidad.upsert({
      where: { nombre: u.nombre },
      create: { nombre: u.nombre, sigla: u.sigla },
      update: { sigla: u.sigla, activo: true },
      select: { id: true },
    });
    unidadPorSigla.set(u.sigla, row.id);
  }

  const almacenPorNombre = new Map<string, number>();
  for (const a of almacenes) {
    const row = await prisma.almacen.upsert({
      where: { nombre: a.nombre },
      create: { nombre: a.nombre },
      update: { activo: true },
      select: { id: true },
    });
    almacenPorNombre.set(a.nombre, row.id);
  }

  // Usuarios (upsert por username). Reconciliar almacenes observados.
  for (const u of usuarios) {
    const unidadId = u.unidad ? unidadPorSigla.get(u.unidad) ?? null : null;
    const almacenId = u.almacen ? almacenPorNombre.get(u.almacen) ?? null : null;

    const row = await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      create: { usuario: u.usuario, nombre: u.nombre, password, rol: u.rol, unidadId, almacenId },
      update: { nombre: u.nombre, rol: u.rol, activo: true, unidadId, almacenId },
      select: { id: true },
    });

    if (u.rol === Rol.observador_almacen) {
      await prisma.usuarioAlmacenObservado.deleteMany({ where: { usuarioId: row.id } });
      const ids = (u.observados ?? [])
        .map((n) => almacenPorNombre.get(n))
        .filter((id): id is number => id != null);
      if (ids.length > 0) {
        await prisma.usuarioAlmacenObservado.createMany({
          data: ids.map((almacenId) => ({ usuarioId: row.id, almacenId })),
        });
      }
    }
  }

  console.log('✅ Seed de desarrollo completado:');
  console.log(`   - ${unidades.length} unidades`);
  console.log(`   - ${almacenes.length} almacenes`);
  console.log(`   - ${usuarios.length} usuarios de prueba (clave: "${PASSWORD}")`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error en seed-dev:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
