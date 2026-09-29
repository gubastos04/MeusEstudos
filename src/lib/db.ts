import { PrismaClient } from '@prisma/client'

/**
 * Cliente Prisma unico.
 * Em dev o Next recarrega os modulos a cada alteracao; sem o cache global
 * cada reload abriria uma nova pool de conexoes.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
