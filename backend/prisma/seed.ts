import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client';
import { UNIDADES_INIAF } from './data/unidades-iniaf';

/**
 * Seed del Clasificador por Objeto del Gasto (Partidas).
 *
 * NO se inventan codigos: se leen del documento oficial exportado a CSV en
 *   prisma/data/clasificador.csv   (columnas: codigo,denominacion)
 *
 * El seed calcula automaticamente, para cada fila:
 *   - nivel         = 5 - (cantidad de ceros finales del codigo de 5 digitos)
 *   - padreId       = enlaza al codigo del nivel superior (mismo prefijo)
 *   - seleccionable = true SOLO en nodos hoja (codigos sin hijos en el dataset)
 *
 * Es idempotente (upsert por codigo). Al re-ejecutar NO pisa `ultimoCorrelativo`
 * (para no perder la numeracion de Items ya generados).
 *
 * Alcance: los 9 grupos del Clasificador por Objeto del Gasto (10000 a 90000).
 * Los grupos que la institucion no usa se dejan desactivados desde la UI.
 */

const CSV_PATH = join(__dirname, 'data', 'clasificador.csv');
const GRUPOS_PERMITIDOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface FilaClasificador {
  codigo: string;
  denominacion: string;
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

/** nivel = 5 - ceros finales. 20000 -> 1, 21000 -> 2, 21100 -> 3, 21110 -> 4, 21111 -> 5. */
function nivelDe(codigo: string): number {
  const ceros = codigo.match(/0+$/)?.[0].length ?? 0;
  return 5 - ceros;
}

/** Codigo del padre: pone en cero el digito significativo del nivel actual. null si es grupo (nivel 1). */
function codigoPadre(codigo: string, nivel: number): string | null {
  if (nivel <= 1) return null;
  const arr = codigo.split('');
  arr[nivel - 1] = '0';
  return arr.join('');
}

/** Parser CSV minimo: detecta delimitador (`,` o `;`), soporta comillas y BOM. */
function parseCsv(contenido: string): FilaClasificador[] {
  const texto = contenido.replace(/^﻿/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return [];

  const delimitador =
    (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const partirLinea = (linea: string): string[] => {
    const campos: string[] = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = !entreComillas;
        }
      } else if (ch === delimitador && !entreComillas) {
        campos.push(actual);
        actual = '';
      } else {
        actual += ch;
      }
    }
    campos.push(actual);
    return campos.map((c) => c.trim());
  };

  // Descartar cabecera si la primera celda no es un codigo numerico.
  const primeraCelda = partirLinea(lineas[0])[0];
  const inicio = /^\d+$/.test(primeraCelda) ? 0 : 1;

  const filas: FilaClasificador[] = [];
  for (let i = inicio; i < lineas.length; i++) {
    const [codigo, ...resto] = partirLinea(lineas[i]);
    const denominacion = resto.join(delimitador).trim();
    if (codigo) filas.push({ codigo: codigo.trim(), denominacion });
  }
  return filas;
}

function validar(filas: FilaClasificador[]): FilaClasificador[] {
  const vistos = new Map<string, FilaClasificador>();
  const errores: string[] = [];

  for (const fila of filas) {
    if (!/^\d{5}$/.test(fila.codigo)) {
      errores.push(`Codigo invalido (debe ser 5 digitos): "${fila.codigo}"`);
      continue;
    }
    if (!GRUPOS_PERMITIDOS.includes(fila.codigo[0])) {
      errores.push(
        `Codigo fuera de alcance (grupos 10000 a 90000): "${fila.codigo}"`,
      );
      continue;
    }
    if (!fila.denominacion) {
      errores.push(`Codigo sin denominacion: "${fila.codigo}"`);
      continue;
    }
    if (vistos.has(fila.codigo)) {
      errores.push(`Codigo duplicado en el CSV: "${fila.codigo}"`);
      continue;
    }
    vistos.set(fila.codigo, fila);
  }

  if (errores.length > 0) {
    throw new Error(
      `Se encontraron ${errores.length} problema(s) en el CSV:\n  - ${errores.join('\n  - ')}`,
    );
  }
  return [...vistos.values()];
}

/**
 * Bootstrap del super_admin inicial. El sistema no tiene registro publico, asi
 * que se necesita un primer usuario para poder ingresar y crear a los demas.
 * Idempotente: solo crea uno si NO existe ningun super_admin.
 */
async function sembrarSuperAdmin() {
  const yaExiste = await prisma.usuario.findFirst({
    where: { rol: 'super_admin' },
    select: { id: true },
  });
  if (yaExiste) {
    console.log('ℹ️  Ya existe un super_admin, no se crea otro.');
    return;
  }

  const username = process.env.SEED_ADMIN_USER ?? 'admin';
  const passwordPlano = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const nombre = process.env.SEED_ADMIN_NOMBRE ?? 'Administrador del Sistema';

  const password = await bcrypt.hash(passwordPlano, 10);
  await prisma.usuario.create({
    data: { nombre, usuario: username, password, rol: 'super_admin' },
  });

  console.log(`✅ super_admin inicial creado (usuario: "${username}").`);
}

/**
 * Organigrama real del INIAF (grupo MOF). Idempotente (upsert por sigla). Dos
 * pasadas: primero crea/actualiza todas, despues resuelve el padre por sigla,
 * asi el orden del array no importa.
 */
async function sembrarUnidades() {
  // Paso 1: crear/actualizar todas (grupo MOF), sin padre todavia.
  for (const u of UNIDADES_INIAF) {
    await prisma.unidad.upsert({
      where: { sigla: u.sigla },
      create: { nombre: u.nombre, sigla: u.sigla, grupo: 'MOF' },
      update: { nombre: u.nombre, grupo: 'MOF', activo: true },
    });
  }

  // Paso 2: resolver el padre por sigla.
  const filas = await prisma.unidad.findMany({
    select: { id: true, sigla: true },
  });
  const idPorSigla = new Map(filas.map((f) => [f.sigla, f.id]));

  for (const u of UNIDADES_INIAF) {
    await prisma.unidad.update({
      where: { sigla: u.sigla },
      data: { padreId: u.padre ? (idPorSigla.get(u.padre) ?? null) : null },
    });
  }

  console.log(
    `✅ ${UNIDADES_INIAF.length} unidades del organigrama (grupo MOF) sembradas.`,
  );
}

async function main() {
  await sembrarSuperAdmin();
  await sembrarUnidades();

  if (!existsSync(CSV_PATH)) {
    throw new Error(
      `No se encontro el archivo del Clasificador en:\n  ${CSV_PATH}\n\n` +
        `Exporta el Clasificador oficial (grupos 20000 y 30000) a CSV con columnas ` +
        `"codigo,denominacion" y guardalo en esa ruta. Hay una plantilla en ` +
        `prisma/data/clasificador.example.csv`,
    );
  }

  const filas = validar(parseCsv(readFileSync(CSV_PATH, 'utf8')));
  const codigos = new Set(filas.map((f) => f.codigo));

  // Deteccion de hojas: un codigo es hoja si ningun otro codigo lo tiene como padre.
  const tieneHijos = new Set<string>();
  for (const { codigo } of filas) {
    const padre = codigoPadre(codigo, nivelDe(codigo));
    if (padre) tieneHijos.add(padre);
  }

  // Advertir si algun padre referenciado no esta en el dataset (arbol incompleto).
  const padresFaltantes = new Set<string>();
  for (const { codigo } of filas) {
    const padre = codigoPadre(codigo, nivelDe(codigo));
    if (padre && !codigos.has(padre))
      padresFaltantes.add(`${codigo} -> falta padre ${padre}`);
  }
  if (padresFaltantes.size > 0) {
    console.warn(
      `⚠️  ${padresFaltantes.size} codigo(s) referencian un padre que no esta en el CSV ` +
        `(quedaran sin padreId):\n  - ${[...padresFaltantes].join('\n  - ')}`,
    );
  }

  // Paso 1: upsert de todas las partidas (sin padreId). No se toca ultimoCorrelativo al actualizar.
  for (const { codigo, denominacion } of filas) {
    const nivel = nivelDe(codigo);
    const seleccionable = !tieneHijos.has(codigo);
    await prisma.partida.upsert({
      where: { codigo },
      create: { codigo, denominacion, nivel, seleccionable, activo: true },
      update: { denominacion, nivel, seleccionable },
    });
  }

  // Paso 2: enlazar padreId ahora que todas existen.
  let enlazadas = 0;
  for (const { codigo } of filas) {
    const padre = codigoPadre(codigo, nivelDe(codigo));
    if (!padre || !codigos.has(padre)) continue;
    const padreRow = await prisma.partida.findUnique({
      where: { codigo: padre },
      select: { id: true },
    });
    if (padreRow) {
      await prisma.partida.update({
        where: { codigo },
        data: { padreId: padreRow.id },
      });
      enlazadas++;
    }
  }

  const total = filas.length;
  const hojas = filas.filter((f) => !tieneHijos.has(f.codigo)).length;
  console.log('✅ Seed de Partidas completado:');
  console.log(`   - ${total} partidas cargadas/actualizadas`);
  console.log(`   - ${enlazadas} enlaces padre-hijo`);
  console.log(`   - ${hojas} nodos hoja (seleccionable = true)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en el seed:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
