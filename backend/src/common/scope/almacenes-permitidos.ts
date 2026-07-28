import { Rol } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Que almacenes puede VER un usuario.
 *
 * `null` = sin restriccion (super_admin / admin). Un array = exactamente esos
 * almacenes; un array vacio significa "ninguno" y el que consulta debe tratarlo
 * como tal, no como "todos".
 *
 * Vive en `common/` y no dentro de un modulo porque la misma regla la aplican
 * ingresos, stock y kardex — y la va a aplicar egresos. Duplicarla es lo que
 * hace que un rol nuevo se arregle en un lado y se olvide en otro.
 */
export async function almacenesPermitidos(
  prisma: PrismaService,
  user: AuthenticatedUser,
): Promise<number[] | null> {
  if (user.rol === Rol.responsable_almacen) {
    return user.almacenId != null ? [user.almacenId] : [];
  }
  if (user.rol === Rol.observador_almacen) {
    const observados = await prisma.usuarioAlmacenObservado.findMany({
      where: { usuarioId: user.id },
      select: { almacenId: true },
    });
    return observados.map((o) => o.almacenId);
  }
  return null; // super_admin / admin
}

/**
 * Filtro de almacen listo para el `where` de Prisma, combinando el scope del
 * usuario con el almacen que haya pedido en la query.
 *
 * El `almacenId` de la query solo se respeta si el usuario no tiene scope
 * propio; si lo tiene, manda el scope (que un responsable pida otro almacen no
 * puede ampliar lo que ve).
 */
export function filtroAlmacen(
  scope: number[] | null,
  almacenIdPedido?: number,
): { almacenId?: number | { in: number[] } } {
  if (scope !== null) return { almacenId: { in: scope } };
  return almacenIdPedido ? { almacenId: almacenIdPedido } : {};
}
