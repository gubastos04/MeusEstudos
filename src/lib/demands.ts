import { db } from './db'
import { getDemands, getDemand } from './content/loader'
import { demandSchema, type Demand } from './content/schema'

/**
 * Demandas disponiveis para um usuario: as do curriculo (/content) mais as
 * geradas por IA para ele.
 *
 * Isolamento: uma demanda gerada pertence a quem pediu. Nenhuma consulta aqui
 * aceita ownerId de outro usuario.
 */

export type DemandWithOrigin = Demand & { origin: 'curriculo' | 'gerada' }

export async function getDemandsForUser(userId: string): Promise<DemandWithOrigin[]> {
  const fromContent: DemandWithOrigin[] = getDemands().map((demand) => ({ ...demand, origin: 'curriculo' }))

  const rows = await db.demand.findMany({
    where: { generated: true, ownerId: userId },
    orderBy: { syncedAt: 'desc' },
  })

  const generated: DemandWithOrigin[] = []
  for (const row of rows) {
    if (!row.payload) continue
    try {
      const parsed = demandSchema.safeParse(JSON.parse(row.payload))
      if (parsed.success) generated.push({ ...parsed.data, origin: 'gerada' })
    } catch {
      // Payload corrompido: a demanda simplesmente nao aparece.
    }
  }

  return [...generated, ...fromContent]
}

export async function getDemandForUser(userId: string, demandId: string): Promise<DemandWithOrigin | null> {
  const fromContent = getDemand(demandId)
  if (fromContent) return { ...fromContent, origin: 'curriculo' }

  const row = await db.demand.findFirst({
    where: { id: demandId, generated: true, ownerId: userId },
  })
  if (!row?.payload) return null

  try {
    const parsed = demandSchema.safeParse(JSON.parse(row.payload))
    return parsed.success ? { ...parsed.data, origin: 'gerada' } : null
  } catch {
    return null
  }
}
