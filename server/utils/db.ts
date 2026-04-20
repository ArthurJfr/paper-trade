import { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Prisma singleton · Nitro recharge le module en dev, on cache l'instance
// sur globalThis pour éviter les connexions SQLite qui s'accumulent.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  __paperTradePrisma?: PrismaClient
}

export const prisma: PrismaClient =
  globalForPrisma.__paperTradePrisma
  ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__paperTradePrisma = prisma
}
