# Imagen unica (no multi-stage): `prisma/seed.ts` importa el cliente generado
# por su ruta TypeScript (`../src/generated/prisma/client`, no la compilada),
# asi que el contenedor necesita tanto `dist/` (para `node dist/main`) como
# `src/`, `prisma/` y el CLI de Prisma + ts-node (para `pnpm prisma migrate
# deploy` y `pnpm seed` via `docker compose exec`). Separar build/runtime acá
# obligaria a copiar selectivamente media docena de rutas con alto riesgo de
# olvidarse una — para una demo, simple y robusto gana.
#
# Debian (no Alpine): bcrypt y sharp son nativos y andan sin sorpresas sobre
# glibc. Prisma acá usa el driver adapter (@prisma/adapter-pg), asi que no hay
# binario de motor de consultas del que preocuparse.
FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
