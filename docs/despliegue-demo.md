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

**Apagar todo** (sin perder datos — los volúmenes quedan):
```bash
docker compose -f docker-compose.prod.yml down
```

**Borrar todo, incluidos los datos** (empezar de cero):
```bash
docker compose -f docker-compose.prod.yml down -v
```
