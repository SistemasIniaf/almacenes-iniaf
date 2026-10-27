/**
 * El CALENDARIO del sistema es el de Bolivia, no el del servidor.
 *
 * La gestion de un documento y los limites de un dia (filtros por fecha, la
 * ventana del kardex) se calculan aca y en ningun otro lado. Antes salian de
 * `getFullYear()` —la zona del proceso, que dentro del contenedor Docker es
 * UTC— y de `Date.UTC`, asi que todo lo registrado entre las 20:00 y la
 * medianoche caia en el dia siguiente; el 31/12 a esa hora, en la gestion
 * siguiente, con el correlativo 001 del año nuevo.
 *
 * El desfase va FIJO y no via `TZ`: Bolivia es UTC-4 todo el año, sin horario
 * de verano (desde 1932), y asi el resultado no depende de como este
 * configurado el servidor — en desarrollo corre en Windows con la hora local,
 * en produccion en un contenedor en UTC, y los dos tienen que dar lo mismo.
 */
const DESFASE_HORAS = 4;
const DESFASE_MS = DESFASE_HORAS * 60 * 60 * 1000;

/** La gestion (año calendario en Bolivia) en la que cae un instante. */
export function gestionDe(fecha: Date): number {
  return new Date(fecha.getTime() - DESFASE_MS).getUTCFullYear();
}

/**
 * El instante en que EMPIEZA un dia en Bolivia, a partir de un `AAAA-MM-DD`
 * (o un ISO completo: solo se mira la fecha). `sumarDias` corre el dia: los
 * rangos inclusivos piden el inicio del dia SIGUIENTE a `hasta` y comparan con
 * `lt`, porque la fecha guardada tiene hora.
 */
export function inicioDelDia(valor: string, sumarDias = 0): Date {
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + sumarDias, DESFASE_HORAS));
}

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * `29/10/2026 14:30`, en hora de Bolivia: para los mensajes de error que
 * nombran un momento. Con `toLocaleString()` pelado saldria la hora del
 * servidor, que en el contenedor es UTC.
 */
export function fechaHoraBolivia(fecha: Date): string {
  return FORMATO_FECHA_HORA.format(fecha).replace(',', '');
}

/** El 1 de enero de una gestion, 00:00 en Bolivia. */
export function inicioDeGestion(gestion: number): Date {
  return new Date(Date.UTC(gestion, 0, 1, DESFASE_HORAS));
}
