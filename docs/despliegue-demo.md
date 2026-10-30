# Desplegar la demo en la VM (Proxmox, Ubuntu)

Guía para levantar el sistema en la VM que te habilitó la institución, para
que el encargado de almacenes lo revise. Usa `docker-compose.prod.yml`
(raíz del repo) — son los mismos archivos que se van a reusar cuando llegue
el servidor on-premise definitivo, así que esto no es un atajo descartable.

> **Pendiente fuera de este documento**: que se vea "desde cualquier lado"
> depende de que el área de redes de la institución confirme/habilite la IP
> pública y redirija el puerto 80 hacia esta VM. Eso no se configura desde
> acá. Mientras tanto, estos pasos dejan el sistema andando perfecto dentro
> de la red/VPN de la institución — compartí esa IP interna con el encargado
> si todavía no hay IP pública.

## 1. Conectarte a la VM

```bash
ssh tu-usuario@<ip-de-la-vm>
```

## 2. Instalar Docker

Si la VM es una Ubuntu nueva (clonada de una plantilla), probablemente no
tenga Docker. Instalación oficial:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Cerrá la sesión SSH y volvé a entrar para que el grupo "docker" tome efecto
```

Verificar:

```bash
docker --version
docker compose version
```

## 3. Clonar el repo

Esta VM es una máquina nueva: necesita su propia clave SSH autorizada en
GitHub (la que tengas en tu otra compu no sirve acá). Generá una y agregala
en GitHub → Settings → SSH Keys antes de clonar:

```bash
ssh-keygen -t ed25519 -C "vm-almacenes-demo"
cat ~/.ssh/id_ed25519.pub   # pegar esto en GitHub
```

Después:

```bash
git clone git@github.com:SistemasIniaf/almacenes-iniaf.git
cd almacenes-iniaf
```

## 4. Variables de entorno

```bash
cp .env.prod.example .env
nano .env   # o el editor que prefieras
```

Completar, generando los secretos con:

```bash
openssl rand -hex 32
```

- `POSTGRES_PASSWORD` y `SEED_ADMIN_PASSWORD`: una contraseña segura cada una
  (**distintas entre sí** — no reusar la misma).
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: cada uno con su propio
  `openssl rand -hex 32` (tienen que ser **distintos entre sí**).

## 5. Levantar el stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez tarda unos minutos (build de las dos imágenes). Verificar que
los tres contenedores estén arriba:

```bash
docker compose -f docker-compose.prod.yml ps
```

`postgres` tiene que figurar `(healthy)` antes de que `backend` arranque —
si `backend` queda reiniciándose, mirá sus logs:

```bash
docker compose -f docker-compose.prod.yml logs backend --tail=50
```

## 6. Migrar y sembrar la base

Primera vez solamente (o después de un `git pull` que traiga migraciones
nuevas):

```bash
docker compose -f docker-compose.prod.yml exec backend pnpm prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend pnpm seed
```

`pnpm seed` deja el catálogo de Partidas y el usuario `admin` inicial
(contraseña: la que pusiste en `SEED_ADMIN_PASSWORD`). Para que el encargado
tenga algo más que mirar que un sistema vacío — unidades, almacenes, usuarios
de todos los roles —, correr además:

```bash
docker compose -f docker-compose.prod.yml exec backend pnpm seed:dev
```

(clave de todos los usuarios de prueba: `password123`, salvo que hayas
cambiado `SEED_DEV_PASSWORD` en el `.env`).

## 7. Verificar

```bash
curl -I http://localhost
```

Tendría que responder `200`. Desde un navegador (en la misma red/VPN que la
VM): `http://<ip-de-la-vm>` — ahí ya se puede loguear con `admin` y la
contraseña del paso 4.

## 8. Firewall

Si la VM tiene `ufw` activo, abrir el puerto 80:

```bash
sudo ufw status            # ver si esta activo
sudo ufw allow 80/tcp
```

## Operación del día a día

**Ver logs en vivo:**
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

**Actualizar a una versión nueva del código:**
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# si hay migraciones nuevas:
docker compose -f docker-compose.prod.yml exec backend pnpm prisma migrate deploy
```

**Mirar la base con Navicat / pgAdmin** (desde tu PC): Postgres está publicado
solo en `127.0.0.1:5432` de la VM —NO hacia la red—, así que se entra por
**túnel SSH**. En la pestaña SSH: IP de la VM, puerto 22 y tu usuario de Linux.
En General: host `localhost`, puerto `5432`, y base/usuario/contraseña los
`POSTGRES_*` del `.env`. No abras el 5432 en el firewall: no hace falta. Y
no edites datos a mano (saldos, movimientos): el kardex deja de cuadrar.

**Apagar todo** (sin perder datos — los volúmenes quedan):
```bash
docker compose -f docker-compose.prod.yml down
```

**Borrar todo, incluidos los datos** (empezar de cero):
```bash
docker compose -f docker-compose.prod.yml down -v
```

> ⚠️ `down -v` borra la base y las fotos. Los respaldos de `respaldos/` NO se
> borran (es una carpeta del servidor, no un volumen), pero hacé uno a mano
> antes por las dudas.

## Respaldos

El servicio `respaldos` hace **un respaldo por día a las 02:00** (hora de
Bolivia) de la base y de las fotos, y conserva los últimos **14 días**. Quedan en
la carpeta `respaldos/` del proyecto, en el servidor:

```
respaldos/db_2026-10-30_0200.dump          ← la base (pg_dump, formato custom)
respaldos/uploads_2026-10-30_0200.tar.gz   ← fotos de ítems y logos
```

La hora y los días se cambian con `RESPALDO_HORA` y `RESPALDO_DIAS` en el
`.env` (y `up -d` para que tome el cambio).

**Hacer un respaldo YA** (antes de actualizar, antes de un `down -v`…):
```bash
docker compose -f docker-compose.prod.yml run --rm respaldos ahora
```

**Ver que esté funcionando:**
```bash
docker compose -f docker-compose.prod.yml logs respaldos
ls -lh respaldos/
```

> ⚠️ **Un respaldo en el mismo disco no protege de que se rompa el disco.**
> Copiá la carpeta `respaldos/` a otra máquina con regularidad, por ejemplo
> desde otra PC de la red:
> `scp -r usuario@<ip-de-la-vm>:~/almacenes-iniaf/respaldos ./respaldos-almacenes`

### Restaurar

Esto **reemplaza** los datos actuales por los del respaldo. Con el sistema
levantado:

```bash
# 1. Frenar el backend para que nadie escriba mientras tanto
docker compose -f docker-compose.prod.yml stop backend

# 2. La base (cambiar el nombre del archivo por el que se quiera restaurar)
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh respaldos -c \
  'pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /respaldos/db_2026-10-30_0200.dump'

# 3. Las fotos (el volumen se monta escribible solo para esto)
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh \
  -v almacenes-iniaf_uploads_data:/destino respaldos -c \
  'rm -rf /destino/* && tar -xzf /respaldos/uploads_2026-10-30_0200.tar.gz -C /destino'

# 4. Volver a levantar el backend
docker compose -f docker-compose.prod.yml start backend
```

El nombre del volumen (`almacenes-iniaf_uploads_data`) es el de la carpeta del
proyecto + `_uploads_data`; se confirma con `docker volume ls`.
