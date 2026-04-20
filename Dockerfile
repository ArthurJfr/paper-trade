# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Paper-Trade · Dockerfile multi-stage (Nuxt 3 + Nitro node-server + Prisma)
# ──────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ─── Stage 1 · deps ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* .npmrc* ./
# Utilise le lockfile s'il existe (build reproductible), sinon le génère.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# ─── Stage 2 · build ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS build
WORKDIR /app

RUN apk add --no-cache openssl \
 && corepack enable \
 && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

# Génère le client Prisma (binaires natifs) avant le build Nuxt.
RUN pnpm prisma generate \
 && pnpm build

# ─── Stage 3 · runtime ───────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0

RUN apk add --no-cache tini curl openssl \
 && addgroup -S nuxt && adduser -S nuxt -G nuxt \
 && mkdir -p /app/data && chown -R nuxt:nuxt /app

# Sortie Nitro auto-suffisante (inclut les dépendances runtime bundlées).
COPY --from=build --chown=nuxt:nuxt /app/.output ./.output

# Prisma : schéma + migrations + client généré + CLI (pour migrate deploy au boot).
COPY --from=build --chown=nuxt:nuxt /app/prisma ./prisma
COPY --from=build --chown=nuxt:nuxt /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nuxt:nuxt /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nuxt:nuxt /app/node_modules/prisma ./node_modules/prisma

COPY --chown=nuxt:nuxt docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh

USER nuxt

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
