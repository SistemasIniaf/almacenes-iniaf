#!/bin/sh
# Respaldo de la base y de las fotos (uploads). Corre dentro del servicio
# `respaldos` de docker-compose.prod.yml, sobre la imagen de postgres (trae
# pg_dump con la MISMA version del servidor; un pg_dump mas viejo no lee una
# base mas nueva).
#
#   respaldar.sh          bucle: un respaldo por dia a la hora RESPALDO_HORA
#   respaldar.sh ahora    un respaldo ya, y termina
#
# Deja en /respaldos (carpeta `respaldos/` del servidor):
#   db_AAAA-MM-DD_HHMM.dump          pg_dump formato custom (se restaura con pg_restore)
#   uploads_AAAA-MM-DD_HHMM.tar.gz   fotos de items y logos
# y borra los de mas de RESPALDO_DIAS dias.
#
# OJO: este archivo tiene que quedar con fin de linea LF (ver .gitattributes):
# con CRLF, sh falla con «not found» en cada linea.
set -eu

DIR=/respaldos
DIAS="${RESPALDO_DIAS:-14}"
HORA="${RESPALDO_HORA:-02}"
# Hora de Bolivia fija (UTC-4, sin horario de verano), igual que el backend:
# no depende de que la imagen traiga la base de zonas horarias.
export TZ='<-04>4'

respaldar() {
  sello=$(date +%Y-%m-%d_%H%M)
  echo "[$(date '+%F %T')] respaldo $sello"

  # Primero a un archivo temporal y recien al terminar se renombra: un
  # respaldo cortado a la mitad (disco lleno, contenedor detenido) nunca queda
  # con nombre de respaldo bueno.
  pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$DIR/.db.tmp"
  mv "$DIR/.db.tmp" "$DIR/db_$sello.dump"

  tar -czf "$DIR/.uploads.tmp" -C /uploads .
  mv "$DIR/.uploads.tmp" "$DIR/uploads_$sello.tar.gz"

  find "$DIR" -maxdepth 1 \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) \
    -mtime +"$DIAS" -print -delete

  echo "[$(date '+%F %T')] listo: $(du -h "$DIR/db_$sello.dump" | cut -f1) base, $(du -h "$DIR/uploads_$sello.tar.gz" | cut -f1) fotos"
}

if [ "${1:-}" = "ahora" ]; then
  respaldar
  exit 0
fi

echo "Respaldos diarios a las ${HORA}:00 (hora de Bolivia), se conservan ${DIAS} dias"
while true; do
  # Cada 10 minutos: si ya es la hora y HOY no hay respaldo, se hace. Asi, si
  # el servidor estuvo apagado a esa hora, se respalda apenas vuelve dentro
  # de la misma hora; y reiniciar el contenedor no duplica el del dia.
  if [ "$(date +%H)" = "$HORA" ] && ! ls "$DIR"/db_"$(date +%Y-%m-%d)"_*.dump >/dev/null 2>&1; then
    respaldar || echo "[$(date '+%F %T')] ERROR: el respaldo fallo" >&2
  fi
  sleep 600
done
