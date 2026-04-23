#!/bin/sh
# ─── Paper-Trade · entrypoint ────────────────────────────────────────────────
# Délègue au CMD (node .output/server/index.mjs).
# ─────────────────────────────────────────────────────────────────────────────
set -eu

echo "[paper-trade] Launching Nuxt server."
exec "$@"
