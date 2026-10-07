# Dos etapas: nginx no necesita node_modules ni codigo fuente, solo el `dist/`
# ya armado — acá si vale la pena separar build de runtime.
#
# Sin build arg de VITE_API_URL a proposito: en produccion esa variable queda
# SIN DEFINIR (ver `src/lib/api.ts`, `urlBaseApi()`), asi el build no queda
# atado a una IP/dominio. nginx.conf hace de proxy de /api/v1 y /uploads hacia
# el backend bajo el MISMO origen.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
