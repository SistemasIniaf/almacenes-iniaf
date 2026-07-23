import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client';
import { Rol } from '../src/generated/prisma/enums';

/**
 * Seed de DESARROLLO (datos de prueba). NO usar en produccion.
 *
 * Crea unidades, almacenes y usuarios cubriendo todos los roles, respetando las
 * reglas de unicidad (un aprobador activo por unidad; un responsable_almacen
 * activo por almacen). Es idempotente (upsert por nombre/username).
 *
 * Ejecutar: pnpm seed:dev
 * Todos los usuarios de prueba comparten la clave SEED_DEV_PASSWORD (def. "password123").
 */

const PASSWORD = process.env.SEED_DEV_PASSWORD ?? 'password123';

// Catalogo compartido de unidades (globales). Cada una lleva su grupo (MOF, OTROS).
const unidades = [
  { nombre: 'Unidad de Planificación', sigla: 'UP', grupo: 'MOF' },
  { nombre: 'Unidad Administrativa Financiera', sigla: 'UAF', grupo: 'MOF' },
  { nombre: 'Unidad de Recursos Humanos', sigla: 'URH', grupo: 'MOF' },
  { nombre: 'Unidad Jurídica', sigla: 'UJ', grupo: 'MOF' },
  // Rubros departamentales (grupo OTROS; se reusan en cada almacen via M2M).
  { nombre: 'Adm. y Finanzas', sigla: 'DEP-AF', grupo: 'OTROS' },
  { nombre: 'Departamental', sigla: 'DEP', grupo: 'OTROS' },
  { nombre: 'Semillas', sigla: 'DEP-SEM', grupo: 'OTROS' },
];

const almacenes = [
  { nombre: 'Almacén Central' },
  { nombre: 'Almacén de Suministros' },
  { nombre: 'Almacén de Materiales' },
  { nombre: 'Almacén Regional' },
];

// Qué unidades muestra cada almacen (M2M). El mismo rubro puede repetirse entre
// almacenes: acá "Almacén Central" hace de Nacional y "Almacén Regional" de
// departamental (comparte los rubros DEP-*).
const enlacesAlmacenUnidad: Record<string, string[]> = {
  'Almacén Central': ['UP', 'UAF', 'URH', 'UJ'],
  'Almacén Regional': ['DEP-AF', 'DEP', 'DEP-SEM'],
};

interface UsuarioDev {
  usuario: string;
  nombre: string;
  /** Obligatorio salvo para super_admin/admin (misma regla que el service). */
  cargo?: string;
  rol: Rol;
  unidad?: string; // sigla
  almacen?: string; // nombre
  observados?: string[]; // nombres de almacen
}

/** `nombre` y `cargo` se guardan en MAYUSCULAS (ver usuarios.service.ts). */
const mayus = (texto: string) => texto.trim().toUpperCase();

const usuarios: UsuarioDev[] = [
  { usuario: 'admin2', nombre: 'Admin Secundario', rol: Rol.admin },

  // Un aprobador activo por unidad. Lleva unidad Y almacen (igual que solicitador).
  {
    usuario: 'aprob_up',
    nombre: 'Aprobador Planificación',
    cargo: 'Jefe de Unidad',
    rol: Rol.aprobador,
    unidad: 'UP',
    almacen: 'Almacén Central',
  },
  {
    usuario: 'aprob_uaf',
    nombre: 'Aprobador Administrativo',
    cargo: 'Jefe de Unidad',
    rol: Rol.aprobador,
    unidad: 'UAF',
    almacen: 'Almacén Central',
  },
  {
    usuario: 'aprob_urh',
    nombre: 'Aprobador RR.HH.',
    cargo: 'Jefe de Unidad',
    rol: Rol.aprobador,
    unidad: 'URH',
    almacen: 'Almacén de Materiales',
  },
  {
    usuario: 'aprob_uj',
    nombre: 'Aprobador Jurídico',
    cargo: 'Jefe de Unidad',
    rol: Rol.aprobador,
    unidad: 'UJ',
    almacen: 'Almacén de Suministros',
  },

  // Solicitadores (requieren unidad + almacen). Varios por unidad permitido.
  {
    usuario: 'solic_up1',
    nombre: 'Solicitador Planificación 1',
    cargo: 'Técnico I',
    rol: Rol.solicitador,
    unidad: 'UP',
    almacen: 'Almacén Central',
  },
  {
    usuario: 'solic_up2',
    nombre: 'Solicitador Planificación 2',
    cargo: 'Técnico II',
    rol: Rol.solicitador,
    unidad: 'UP',
    almacen: 'Almacén de Suministros',
  },
  {
    usuario: 'solic_uaf1',
    nombre: 'Solicitador Administrativo 1',
    cargo: 'Auxiliar Administrativo',
    rol: Rol.solicitador,
    unidad: 'UAF',
    almacen: 'Almacén Central',
  },
  {
    usuario: 'solic_urh1',
    nombre: 'Solicitador RR.HH. 1',
    cargo: 'Técnico en Personal',
    rol: Rol.solicitador,
    unidad: 'URH',
    almacen: 'Almacén de Materiales',
  },

  // Un responsable_almacen activo por almacen. Desde 2026-07-21 tambien lleva
  // unidad (antes no la llevaba).
  {
    usuario: 'resp_central',
    nombre: 'Responsable Almacén Central',
    cargo: 'Responsable de Almacenes',
    rol: Rol.responsable_almacen,
    unidad: 'UAF',
    almacen: 'Almacén Central',
  },
  {
    usuario: 'resp_suministros',
    nombre: 'Responsable Suministros',
    cargo: 'Responsable de Almacenes',
    rol: Rol.responsable_almacen,
    unidad: 'UAF',
    almacen: 'Almacén de Suministros',
  },
  {
    usuario: 'resp_materiales',
    nombre: 'Responsable Materiales',
    cargo: 'Responsable de Almacenes',
    rol: Rol.responsable_almacen,
    unidad: 'UAF',
    almacen: 'Almacén de Materiales',
  },
  {
    usuario: 'resp_regional',
    nombre: 'Responsable Regional',
    cargo: 'Responsable de Almacenes',
    rol: Rol.responsable_almacen,
    unidad: 'UP',
    almacen: 'Almacén Regional',
  },

  // Observadores (sin almacen fijo; ven varios via tabla intermedia).
  {
    usuario: 'obs_auditor',
    nombre: 'Observador Auditor',
    cargo: 'Auditor Interno',
    rol: Rol.observador_almacen,
    observados: [
      'Almacén Central',
      'Almacén de Suministros',
      'Almacén de Materiales',
      'Almacén Regional',
    ],
  },
  {
    usuario: 'obs_control',
    nombre: 'Observador Control Interno',
    cargo: 'Encargado de Control Interno',
    rol: Rol.observador_almacen,
    observados: ['Almacén Central', 'Almacén Regional'],
  },
];

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
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
      create: { nombre: u.nombre, sigla: u.sigla, grupo: u.grupo },
      update: { sigla: u.sigla, grupo: u.grupo, activo: true },
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

  // Enlaces M2M almacen <-> unidad (reemplaza el conjunto de cada almacen).
  for (const [nombreAlmacen, siglas] of Object.entries(enlacesAlmacenUnidad)) {
    const almacenId = almacenPorNombre.get(nombreAlmacen);
    if (almacenId == null) continue;
    await prisma.almacenUnidad.deleteMany({ where: { almacenId } });
    const unidadIds = siglas
      .map((s) => unidadPorSigla.get(s))
      .filter((id): id is number => id != null);
    if (unidadIds.length > 0) {
      await prisma.almacenUnidad.createMany({
        data: unidadIds.map((unidadId) => ({ almacenId, unidadId })),
      });
    }
  }

  // Usuarios (upsert por username). Reconciliar almacenes observados.
  for (const u of usuarios) {
    const unidadId = u.unidad ? (unidadPorSigla.get(u.unidad) ?? null) : null;
    const almacenId = u.almacen
      ? (almacenPorNombre.get(u.almacen) ?? null)
      : null;

    const row = await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      create: {
        usuario: u.usuario,
        nombre: mayus(u.nombre),
        cargo: u.cargo ? mayus(u.cargo) : null,
        password,
        rol: u.rol,
        unidadId,
        almacenId,
      },
      update: {
        nombre: mayus(u.nombre),
        cargo: u.cargo ? mayus(u.cargo) : null,
        rol: u.rol,
        activo: true,
        unidadId,
        almacenId,
      },
      select: { id: true },
    });

    if (u.rol === Rol.observador_almacen) {
      await prisma.usuarioAlmacenObservado.deleteMany({
        where: { usuarioId: row.id },
      });
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
  console.log(
    `   - ${usuarios.length} usuarios de prueba (clave: "${PASSWORD}")`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error en seed-dev:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
