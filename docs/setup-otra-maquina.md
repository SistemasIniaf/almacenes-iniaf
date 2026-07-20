# Levantar el proyecto en otra computadora

Git trae el **código**, las **migraciones** y los **seeds**, pero NO trae los
**datos** de la base ni las **imágenes** de ítems (la DB vive en el volumen de
Docker y `backend/uploads/` está en `.gitignore`). Por eso hay dos caminos.

## 0. Común a ambos caminos

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
```

## Camino A — quiero MIS datos actuales (los de esta compu)

Reproduce exactamente lo que tenés hoy: unidades renombradas, usuarios, ítems, etc.

```bash
# Restaurar el respaldo (incluye esquema + historial de migraciones + datos).
# El archivo dumps/almacenes_db.sql viaja por git.
docker exec -i almacenes_db_dev psql -U postgres -d almacenes_db < dumps/almacenes_db.sql
```

Las imágenes de ítems (`backend/uploads/items/*.webp`) también se versionaron con
`git add -f`, así que ya quedan en su lugar tras el `git pull`. Si en algún
momento las sacás del control de versiones, hay que copiar esa carpeta a mano.

**NO corras las migraciones ni el seed en este camino**: el dump ya trae todo y
volver a sembrar duplicaría o chocaría con los datos.

### Regenerar el respaldo (cuando cambien los datos)

```bash
docker exec almacenes_db_dev pg_dump -U postgres --clean --if-exists almacenes_db > dumps/almacenes_db.sql
```

## Camino B — arranco de cero con datos de ejemplo

No trae tus ediciones manuales; deja la base con el catálogo oficial y usuarios
de prueba.

```bash
cd backend
pnpm prisma migrate deploy      # aplica las migraciones versionadas
pnpm seed                       # partidas (clasificador) + usuario admin inicial
pnpm seed:dev                   # usuarios de prueba (clave: password123)
```

## Arrancar

```bash
cd backend  && pnpm dev         # http://localhost:3000
cd frontend && pnpm dev         # http://localhost:5173
```

Login inicial: usuario `admin`, contraseña `admin123` (definido en
`SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` del `.env`).

> Nota: `dumps/almacenes_db.sql` y las imágenes versionadas son una comodidad
> puntual para mover de máquina. No es un mecanismo de respaldo continuo; si el
> repo se comparte con más gente, conviene sacarlos del control de versiones.
