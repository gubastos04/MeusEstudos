import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Recomendacao de proximo passo e limites.
 *
 * Estas sao regras de produto, nao detalhes de implementacao:
 * - um unico proximo passo, nunca uma lista;
 * - a ordem de prioridade da spec;
 * - o orcamento de tempo e respeitado;
 * - nada de streak: a metrica e dias ativos nos ultimos 7.
 */

const pote = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nome: string) => (pote.has(nome) ? { name: nome, value: pote.get(nome)! } : undefined),
    set: (nome: string, valor: string) => {
      pote.set(nome, valor)
    },
    delete: (nome: string) => {
      pote.delete(nome)
    },
  }),
}))

const { db } = await import('@/lib/db')
const { registerUser } = await import('@/lib/auth')
const { getNextStep, getSuggestions, prontoParaRevisar } = await import('@/lib/next-step')
const { bumpActivity, completeProgress, getActiveDaysInLast7, startProgress } = await import(
  '@/lib/progress'
)
const { rateLimit } = await import('@/lib/rate-limit')

let contador = 0

async function novoUsuario() {
  pote.clear()
  contador += 1
  const email = `proximo-passo-${contador}-${Date.now()}@teste.local`
  const resultado = await registerUser({ name: 'Pessoa', email, password: 'senha-de-teste-local-123' })
  if (!resultado.ok) throw new Error(resultado.error)

  await db.userProfile.update({
    where: { userId: resultado.user.id },
    data: { onboardedAt: new Date(), trackId: 'comeco-do-zero' },
  })

  return resultado.user
}

beforeEach(() => {
  pote.clear()
})

afterAll(async () => {
  await db.$disconnect()
})

describe('próximo passo', () => {
  it('quem está começando recebe o primeiro item do caminho', async () => {
    const usuario = await novoUsuario()

    const passo = await getNextStep(usuario.id)

    expect(passo).not.toBeNull()
    expect(passo?.kind).toEqual('lesson')
    expect(passo?.action).toEqual('Começar')
    expect(passo?.href.startsWith('/estudar/')).toBe(true)
  })

  it('conteúdo interrompido tem prioridade sobre conteúdo novo', async () => {
    const usuario = await novoUsuario()

    // Conclui o primeiro e deixa outro no meio.
    await completeProgress({
      userId: usuario.id,
      nodeType: 'lesson',
      nodeId: 'pc-programar-e-instruir-01',
      moduleId: 'pensamento-computacional',
    })
    await startProgress({
      userId: usuario.id,
      nodeType: 'lesson',
      nodeId: 'python-loops-01',
      moduleId: 'python',
    })

    const passo = await getNextStep(usuario.id)

    expect(passo?.id).toEqual('python-loops-01')
    expect(passo?.action).toEqual('Retomar')
    expect(passo?.reason).toContain('parou no meio')
  })

  it('não sugere de novo o que já foi concluído', async () => {
    const usuario = await novoUsuario()
    const primeiro = await getNextStep(usuario.id)

    await completeProgress({
      userId: usuario.id,
      nodeType: primeiro!.kind === 'checkpoint' ? 'checkpoint' : 'lesson',
      nodeId: primeiro!.id,
      moduleId: 'pensamento-computacional',
    })

    const segundo = await getNextStep(usuario.id)

    expect(segundo?.id).not.toEqual(primeiro?.id)
  })
})

describe('modo tenho X minutos', () => {
  it('devolve no máximo quatro opções', async () => {
    const usuario = await novoUsuario()

    for (const minutos of [10, 20, 45] as const) {
      const sugestoes = await getSuggestions(usuario.id, minutos)
      expect(sugestoes.length).toBeLessThanOrEqual(4)
    }
  })

  it('respeita o tempo disponível', async () => {
    const usuario = await novoUsuario()

    const curtas = await getSuggestions(usuario.id, 10)

    // Cinco minutos de folga: um bloco de 12 min ainda serve para quem tem 10.
    for (const sugestao of curtas) {
      expect(sugestao.minutes).toBeLessThanOrEqual(15)
    }
  })

  it('toda sugestão diz por que está sendo sugerida', async () => {
    const usuario = await novoUsuario()
    const sugestoes = await getSuggestions(usuario.id, 20)

    expect(sugestoes.length).toBeGreaterThan(0)
    for (const sugestao of sugestoes) {
      expect(sugestao.reason.length).toBeGreaterThan(5)
      expect(sugestao.action.length).toBeGreaterThan(2)
    }
  })
})

describe('constância sem streak', () => {
  it('conta dias ativos nos últimos 7, e não sequência', async () => {
    const usuario = await novoUsuario()

    // Dois dias com registro, separados por um dia sem nada.
    const hoje = new Date()
    const anteontem = new Date(hoje.getTime() - 2 * 24 * 60 * 60 * 1000)
    const chave = (data: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(data)

    await bumpActivity(usuario.id, { lessonsCompleted: 1 })
    await db.activity.create({
      data: { userId: usuario.id, day: chave(anteontem), minutes: 15, lessonsCompleted: 1 },
    })

    const atividade = await getActiveDaysInLast7(usuario.id)

    expect(atividade.active).toEqual(2)
    expect(atividade.days).toHaveLength(7)
    // O dia sem registro existe na série, e é apenas "não ativo": nada de perda.
    expect(atividade.days.filter((dia) => !dia.active).length).toEqual(5)
  })

  it('o mesmo dia não é contado duas vezes', async () => {
    const usuario = await novoUsuario()

    await bumpActivity(usuario.id, { lessonsCompleted: 1 })
    await bumpActivity(usuario.id, { exercisesAttempted: 1 })
    await bumpActivity(usuario.id, {}, 10)

    const atividade = await getActiveDaysInLast7(usuario.id)
    const linhas = await db.activity.findMany({ where: { userId: usuario.id } })

    expect(atividade.active).toEqual(1)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.minutes).toEqual(10)
  })
})

describe('limites de uso', () => {
  it('bloqueia depois do teto e informa quanto falta', async () => {
    const chave = `teste-limite-${Date.now()}`

    const primeira = await rateLimit(chave, 2, 60)
    const segunda = await rateLimit(chave, 2, 60)
    const terceira = await rateLimit(chave, 2, 60)

    expect(primeira.allowed).toBe(true)
    expect(segunda.allowed).toBe(true)
    expect(terceira.allowed).toBe(false)
    expect(terceira.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('chaves diferentes não interferem entre si', async () => {
    const agora = Date.now()

    await rateLimit(`limite-a-${agora}`, 1, 60)
    const outra = await rateLimit(`limite-b-${agora}`, 1, 60)

    expect(outra.allowed).toBe(true)
  })

  it('a janela expira e libera de novo', async () => {
    const chave = `teste-janela-${Date.now()}`

    // Janela de 0 segundo: a próxima chamada já encontra a janela vencida.
    await rateLimit(chave, 1, 0)
    const depois = await rateLimit(chave, 1, 0)

    expect(depois.allowed).toBe(true)
  })
})

describe('intervalo crescente entre revisões', () => {
  const agora = new Date('2026-10-05T12:00:00Z')
  const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000)

  it('erro nunca revisado está pronto', () => {
    expect(prontoParaRevisar({ reviewedAt: null, reviewCount: 0 }, agora)).toBe(true)
  })

  it('o intervalo cresce a cada revisão', () => {
    // 1, 3, 7 e 21 dias: na vespera ainda nao, no dia sim.
    const esperado: [number, number][] = [
      [0, 1],
      [1, 3],
      [2, 7],
      [3, 21],
    ]
    for (const [reviewCount, dias] of esperado) {
      expect(prontoParaRevisar({ reviewedAt: diasAtras(dias - 0.1), reviewCount }, agora)).toBe(false)
      expect(prontoParaRevisar({ reviewedAt: diasAtras(dias), reviewCount }, agora)).toBe(true)
    }
  })

  it('depois da quarta revisão o intervalo para de crescer', () => {
    expect(prontoParaRevisar({ reviewedAt: diasAtras(21), reviewCount: 9 }, agora)).toBe(true)
    expect(prontoParaRevisar({ reviewedAt: diasAtras(20), reviewCount: 9 }, agora)).toBe(false)
  })
})
