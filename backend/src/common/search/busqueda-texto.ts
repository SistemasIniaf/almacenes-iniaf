import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Busqueda de texto insensible a mayusculas Y a acentos.
 *
 * Prisma no puede expresar `unaccent(...)` en su DSL (`mode: 'insensitive'` solo
 * cubre mayusculas), asi que el filtro de texto se resuelve con SQL crudo que
 * devuelve los ids coincidentes; el service los usa como `id: { in: ids }` y
 * conserva toda su logica Prisma (filtros, orden, paginacion, includes).
 *
 * Se apoya en la funcion `f_unaccent` y los indices GIN de trigramas creados en
 * la migracion `20260719161128_busqueda_sin_acentos`. Si se agrega un buscador
 * a un modulo nuevo, hay que crear tambien su indice en una migracion.
 */

/** Identificador SQL valido: los nombres se interpolan, no se parametrizan. */
const IDENTIFICADOR_VALIDO = /^[a-z_][a-z0-9_]*$/;

function validarIdentificador(nombre: string): string {
  if (!IDENTIFICADOR_VALIDO.test(nombre)) {
    // Defensa en profundidad: hoy tabla/columnas son literales del codigo, nunca
    // entrada del usuario. Esto evita que un descuido futuro abra un SQL injection.
    throw new Error(`Identificador SQL invalido: "${nombre}"`);
  }
  return nombre;
}

/** Escapa los comodines de LIKE para que se busquen como texto literal. */
function escaparPatron(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/**
 * Devuelve los ids de `tabla` cuyo texto coincide con `q` en alguna de las
 * `columnas`, ignorando mayusculas y acentos.
 *
 * Un array vacio significa "ninguna coincidencia" (no "sin filtro"): el service
 * debe pasarlo igual a `id: { in: [] }` para que el listado salga vacio.
 */
export async function buscarIdsPorTexto(
  prisma: PrismaService,
  tabla: string,
  columnas: string[],
  q: string,
): Promise<number[]> {
  validarIdentificador(tabla);
  columnas.forEach(validarIdentificador);

  const patron = `%${escaparPatron(q)}%`;

  // f_unaccent en AMBOS lados: normaliza tanto la columna como lo tecleado, de
  // modo que "almacen", "almacén" y "ALMACÉN" encuentran lo mismo.
  const condiciones = Prisma.join(
    columnas.map(
      (columna) =>
        Prisma.sql`f_unaccent(${Prisma.raw(columna)}) ILIKE f_unaccent(${patron})`,
    ),
    ' OR ',
  );

  const filas = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM ${Prisma.raw(tabla)} WHERE ${condiciones}
  `;

  return filas.map((fila) => fila.id);
}
