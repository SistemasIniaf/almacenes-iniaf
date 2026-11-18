import { BadRequestException, Injectable } from '@nestjs/common';

import { bloquearSerie } from '../../common/correlativo/bloquear-serie';
import { exigirGestionAbierta } from '../../common/cierre/gestion-cerrada';
import { gestionDe, inicioDelDia } from '../../common/fechas/zona-horaria';
import { EstadoIngreso, TipoMovimiento } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { FilaSaldoDto, ImportarSaldosDto } from './dto/importar-saldos.dto';

/** Miles de lotes en UNA transaccion: los 5 s por defecto de Prisma no alcanzan. */
const TIMEOUT_TRANSACCION_MS = 5 * 60 * 1000;

/** Lo que dice el kardex en la ENTRADA de un lote migrado. */
const MOTIVO = 'SALDO INICIAL (SISTEMA ANTERIOR)';

/**
 * Estado de una fila tras validarla. `importado` no es un error: el lote ya
 * entro en una carga anterior (se importa almacen por almacen, a medida que se
 * completa la correspondencia) y simplemente se salta.
 */
type EstadoFila = 'ok' | 'error' | 'importado';

type FilaResuelta = {
  fila: FilaSaldoDto;
  almacenId: number;
  fuenteId: number;
  itemId: number;
};

/** Para comparar lo que se tipeo en la planilla con el catalogo. */
const normalizar = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

/**
 * CARGA INICIAL de saldos traidos del sistema anterior (2026-11-12). La vía
 * acordada es script → planilla → importacion: el catalogo de items se arma
 * desde cero, asi que una persona resuelve en la planilla a que item, almacen y
 * fuente NUEVOS va cada lote, y esta pantalla la importa. Ver
 * `tools/migracion-saldos/` y docs/decisiones-ingresos.md, punto 13.
 *
 * Cada ingreso del sistema anterior con lotes vivos se vuelve un Ingreso con
 * `saldoInicial = true` (sin numero, fuera del registro de ingresos), con sus
 * respaldos copiados; sus lotes, con su precio y su saldo, y una ENTRADA de
 * kardex cada uno. Desde ahi son lotes como cualquier otro.
 */
@Injectable()
export class SaldosInicialesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Revisa la planilla SIN grabar nada: el estado de cada fila y el resumen por
   * almacen, para que la pantalla muestre que se puede importar y que falta.
   */
  async validar(dto: ImportarSaldosDto) {
    const { estados, almacenPorNombre } = await this.resolver(dto.filas);
    const errorFecha = this.errorFecha(dto.fechaCorte);

    // Resumen por almacen NUEVO (lo que la persona elige importar). Las filas
    // sin almacen asignado van juntas, con `almacenId: null`.
    const almacenes = new Map<
      string,
      {
        almacenId: number | null;
        almacen: string;
        lotes: number;
        valor: number;
        errores: number;
        importados: number;
      }
    >();
    dto.filas.forEach((fila, i) => {
      const nombre = normalizar(fila.almacen);
      const g = almacenes.get(nombre) ?? {
        // Por nombre y no por la fila resuelta: un almacen ya importado entero
        // no tiene filas resueltas y quedaria como «sin asignar».
        almacenId: almacenPorNombre.get(nombre)?.id ?? null,
        almacen: nombre || '(SIN ALMACÉN ASIGNADO)',
        lotes: 0,
        valor: 0,
        errores: 0,
        importados: 0,
      };
      g.lotes++;
      g.valor += fila.cantidad * fila.precioUnitario;
      if (estados[i].estado === 'error') g.errores++;
      if (estados[i].estado === 'importado') g.importados++;
      almacenes.set(nombre, g);
    });

    return {
      errorFecha,
      // Solo las filas que NO estan bien: con 3.000 lotes, mandar las buenas es
      // peso sin informacion.
      filas: estados
        .map((e, indice) => ({ indice, ...e }))
        .filter((e) => e.estado !== 'ok'),
      almacenes: [...almacenes.values()]
        .map((a) => ({ ...a, valor: Math.round(a.valor * 100) / 100 }))
        .sort((a, b) => a.almacen.localeCompare(b.almacen)),
    };
  }

  /**
   * Importa TODO o NADA: si alguna fila tiene error o ya fue importada, no
   * graba ninguna. La pantalla manda solo las filas de los almacenes que esten
   * listos, asi que el caso normal no tropieza con esto — es la barrera.
   */
  async importar(dto: ImportarSaldosDto, user: AuthenticatedUser) {
    const errorFecha = this.errorFecha(dto.fechaCorte);
    if (errorFecha) throw new BadRequestException(errorFecha);

    // El ultimo instante del dia de corte, en Bolivia. Si el corte es HOY ese
    // instante todavia no llego: se usa AHORA, o la entrada quedaba fechada a
    // las 23:59 de esta noche y una entrega del mismo dia salia antes que ella.
    const finDelDia = new Date(inicioDelDia(dto.fechaCorte, 1).getTime() - 1);
    const ahora = new Date();
    const fecha = finDelDia > ahora ? ahora : finDelDia;
    const gestion = gestionDe(fecha);

    return this.prisma.$transaction(
      async (tx) => {
        // Dos importaciones a la vez podrian meter el mismo lote dos veces: se
        // serializan, y RECIEN AHI se valida (el «ya importado» se lee adentro).
        await bloquearSerie(tx, 'saldosIniciales', 0);
        const { estados, resueltas } = await this.resolver(dto.filas, tx);
        const malas = estados
          .map((e, i) => ({ ...e, fila: dto.filas[i] }))
          .filter((e) => e.estado !== 'ok');
        if (malas.length > 0) {
          const muestra = malas
            .slice(0, 5)
            .map(
              (m) => `lote ${m.fila.loteAnteriorId}: ${m.mensajes.join(', ')}`,
            );
          throw new BadRequestException(
            `No se importó nada: ${malas.length} fila(s) no están listas (${muestra.join('; ')}${malas.length > 5 ? '…' : ''}).`,
          );
        }

        // Un Ingreso por cada ingreso del sistema anterior (+ almacen y fuente
        // nuevos: si la persona junto almacenes, siguen siendo documentos
        // distintos).
        const grupos = new Map<string, FilaResuelta[]>();
        for (const r of resueltas.values()) {
          const clave = `${r.almacenId}|${r.fuenteId}|${r.fila.ingresoAnteriorId}`;
          grupos.set(clave, [...(grupos.get(clave) ?? []), r]);
        }

        // La carga se fecha al dia de corte: no puede caer en una gestion que el
        // almacen ya cerro (cambiaria una foto ya emitida).
        const almacenesDestino = new Set(
          [...grupos.values()].map((g) => g[0].almacenId),
        );
        for (const almacenId of almacenesDestino) {
          await exigirGestionAbierta(tx, almacenId, [gestion]);
        }

        let lotes = 0;
        for (const grupo of grupos.values()) {
          const { fila, almacenId, fuenteId } = grupo[0];
          const ingreso = await tx.ingreso.create({
            data: {
              estado: EstadoIngreso.CONFIRMADO,
              saldoInicial: true,
              gestion,
              fechaIngreso: fecha,
              almacenId,
              fuenteFinanciamientoId: fuenteId,
              registradoPorId: user.id,
              numeroFactura: fila.factura || null,
              procesoC31: fila.procesoC31 || null,
              certificacion: fila.certificacion || null,
              notaRemision: fila.notaRemision || null,
              observacion: this.observacion(fila),
            },
            select: { id: true },
          });
          const creados = await tx.ingresoDetalle.createManyAndReturn({
            data: grupo.map((r) => ({
              ingresoId: ingreso.id,
              itemId: r.itemId,
              cantidad: r.fila.cantidad,
              precioUnitario: r.fila.precioUnitario,
              saldoCantidad: r.fila.cantidad,
              observacion: r.fila.observacion?.trim().toUpperCase() || null,
              loteAnteriorId: r.fila.loteAnteriorId,
            })),
            select: {
              id: true,
              itemId: true,
              cantidad: true,
              precioUnitario: true,
            },
          });
          await tx.movimientoKardex.createMany({
            data: creados.map((l) => ({
              tipo: TipoMovimiento.ENTRADA,
              itemId: l.itemId,
              almacenId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              ingresoId: ingreso.id,
              ingresoDetalleId: l.id,
              fecha,
              motivo: MOTIVO,
            })),
          });
          lotes += creados.length;
        }

        return { documentos: grupos.size, lotes, gestion };
      },
      { timeout: TIMEOUT_TRANSACCION_MS, maxWait: TIMEOUT_TRANSACCION_MS },
    );
  }

  // ---------------------------------------------------------------------------

  /**
   * Resuelve contra el catalogo lo que la planilla dice por nombre/codigo, y
   * marca cada fila. Recibe `tx` para poder releer «ya importado» dentro de la
   * transaccion de `importar`.
   */
  private async resolver(
    filas: FilaSaldoDto[],
    tx: Pick<
      PrismaService,
      'almacen' | 'fuenteFinanciamiento' | 'item' | 'ingresoDetalle'
    > = this.prisma,
  ) {
    const codigos = [
      ...new Set(
        filas.map((f) => f.itemCodigo?.trim().toUpperCase()).filter(Boolean),
      ),
    ] as string[];
    const [almacenes, fuentes, items, importados] = await Promise.all([
      tx.almacen.findMany({ select: { id: true, nombre: true, activo: true } }),
      tx.fuenteFinanciamiento.findMany({
        select: { id: true, nombre: true, activo: true },
      }),
      tx.item.findMany({
        where: { codigo: { in: codigos } },
        select: { id: true, codigo: true, activo: true },
      }),
      tx.ingresoDetalle.findMany({
        where: {
          loteAnteriorId: { in: filas.map((f) => f.loteAnteriorId) },
          ingreso: { estado: EstadoIngreso.CONFIRMADO },
        },
        select: { loteAnteriorId: true },
      }),
    ]);
    const almacenPorNombre = new Map(
      almacenes.map((a) => [normalizar(a.nombre), a]),
    );
    const fuentePorNombre = new Map(
      fuentes.map((f) => [normalizar(f.nombre), f]),
    );
    const itemPorCodigo = new Map(
      items.map((i) => [i.codigo.toUpperCase(), i]),
    );
    const yaImportados = new Set(importados.map((d) => d.loteAnteriorId));

    const vistos = new Map<number, number>();
    for (const f of filas)
      vistos.set(f.loteAnteriorId, (vistos.get(f.loteAnteriorId) ?? 0) + 1);

    const resueltas = new Map<number, FilaResuelta>();
    const estados = filas.map(
      (fila, i): { estado: EstadoFila; mensajes: string[] } => {
        if (yaImportados.has(fila.loteAnteriorId)) {
          return { estado: 'importado', mensajes: ['ya importado'] };
        }
        const mensajes: string[] = [];
        if ((vistos.get(fila.loteAnteriorId) ?? 0) > 1)
          mensajes.push('lote repetido en la planilla');

        const almacen = almacenPorNombre.get(normalizar(fila.almacen));
        if (!normalizar(fila.almacen)) mensajes.push('falta el almacén nuevo');
        else if (!almacen)
          mensajes.push(`no existe el almacén «${fila.almacen}»`);
        else if (!almacen.activo)
          mensajes.push(`el almacén «${almacen.nombre}» está dado de baja`);

        const fuente = fuentePorNombre.get(normalizar(fila.fuente));
        if (!normalizar(fila.fuente)) mensajes.push('falta la fuente nueva');
        else if (!fuente) mensajes.push(`no existe la fuente «${fila.fuente}»`);
        else if (!fuente.activo)
          mensajes.push(`la fuente «${fuente.nombre}» está dada de baja`);

        const codigo = fila.itemCodigo?.trim().toUpperCase();
        const item = codigo ? itemPorCodigo.get(codigo) : undefined;
        if (!codigo) mensajes.push('falta el código del ítem nuevo');
        else if (!item) mensajes.push(`no existe el ítem ${codigo}`);
        else if (!item.activo)
          mensajes.push(`el ítem ${item.codigo} está dado de baja`);

        if (mensajes.length > 0 || !almacen || !fuente || !item) {
          return { estado: 'error', mensajes };
        }
        resueltas.set(i, {
          fila,
          almacenId: almacen.id,
          fuenteId: fuente.id,
          itemId: item.id,
        });
        return { estado: 'ok', mensajes: [] };
      },
    );

    return { estados, resueltas, almacenPorNombre };
  }

  /** La fecha de corte no puede ser futura: es «saldos AL día X». */
  private errorFecha(fechaCorte: string): string | null {
    if (inicioDelDia(fechaCorte) > new Date()) {
      return 'La fecha de corte no puede ser futura: los saldos son al cierre de ese día.';
    }
    return null;
  }

  /**
   * De donde viene: lo que no tiene columna propia en el Ingreso (el numero y
   * la fecha de alla, el almacen viejo y el proveedor, que en el sistema nuevo
   * es un catalogo que no se migra).
   */
  private observacion(f: FilaSaldoDto): string {
    const partes = [
      `SALDO INICIAL DEL SISTEMA ANTERIOR: INGRESO Nº ${f.numeroAnterior || '?'}` +
        (f.fechaAnterior ? ` DEL ${f.fechaAnterior}` : '') +
        (f.almacenAnterior ? ` (${f.almacenAnterior})` : ''),
    ];
    if (f.proveedor)
      partes.push(`PROVEEDOR: ${f.proveedor}${f.nit ? ` · NIT ${f.nit}` : ''}`);
    return partes.join(' · ').toUpperCase();
  }
}
