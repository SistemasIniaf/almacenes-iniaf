# Levantar el proyecto en otra computadora

Git trae el **código**, las **migraciones** y los **seeds**, pero NO los **datos**
de la base (viven en el volumen de Docker, propio de cada máquina). Como se
arranca de cero, la base se llena corriendo las migraciones y el seed.

## Pasos

```bash
# 1. Traer el código
git pull                       # o git clone ...
git checkout feat/frontend-integracion

# 2. Variables de entorno (los .env NO se versionan; se copian del ejemplo)
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env

# 3. Dependencias (cada paquete por separado; NUNCA en la raíz)
cd backend  && pnpm install && cd ..
cd frontend && pnpm install && cd ..

# 4. Postgres (Docker)
docker compose up -d postgres

# 5. Base: migraciones + seed (SOLO admin + partidas)
cd backend
pnpm prisma migrate deploy      # aplica las migraciones versionadas
pnpm seed                       # carga las partidas del clasificador y crea el admin
cd ..
```

`pnpm seed` deja la base con:
- El **catálogo de Partidas** (grupos 20000 y 30000 del clasificador).
- El usuario **admin** inicial (`admin` / `admin123`).

Nada más: sin unidades, almacenes, ítems ni usuarios de prueba. Todo eso se carga
después desde la aplicación.

> `pnpm seed` es idempotente: si lo corrés de nuevo, no duplica partidas ni crea
> un segundo admin.

## Arrancar

```bash
cd backend  && pnpm dev         # http://localhost:3000
cd frontend && pnpm dev         # http://localhost:5173
```

Login: usuario `admin`, contraseña `admin123` (definidos en `SEED_ADMIN_USER` /
`SEED_ADMIN_PASSWORD` del `.env`).

## ¿Y si quisiera cargar datos de prueba?

Opcional, solo para no arrancar tan vacío. Crea usuarios de ejemplo de todos los
roles (clave `password123`), con sus unidades y almacenes:

```bash
cd backend && pnpm seed:dev
```
