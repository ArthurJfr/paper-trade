#!/bin/sh
# ─── Paper-Trade · entrypoint ────────────────────────────────────────────────
# 1. Applique les migrations Prisma (idempotent).
# 2. Délègue au CMD (node .output/server/index.mjs).
# ─────────────────────────────────────────────────────────────────────────────
set -eu

echo "[paper-trade] Applying Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

echo "[paper-trade] Launching Nuxt server."
exec "$@"
