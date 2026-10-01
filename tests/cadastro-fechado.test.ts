import { describe, expect, it } from 'vitest'

/**
 * Cadastro fechado (PERMITIR_CADASTRO=false).
 *
 * Existe para instalacao pessoal, e ganhou uso real: enquanto o provedor de
 * email so entrega no dono da conta, quem criasse conta aqui e esquecesse a
 * senha ficaria trancado fora sem nenhum caminho de volta — a tela diz que
 * enviou, e o email nunca chega.
 *
 * O teste cobre o servidor, nao a tela. Esconder o link de "criar conta" nao e
 * defesa: a rota continua existindo para quem a chamar direto.
 *
 * Arquivo separado de proposito: env() le process.env uma vez e guarda o
 * resultado, entao o valor precisa estar posto antes do primeiro import.
 */

process.env.PERMITIR_CADASTRO = 'false'

const { registerUser } = await import('@/lib/auth')

describe('com os cadastros fechados', () => {
  it('o servidor recusa o registro, mesmo chamado direto', async () => {
    const resultado = await registerUser({
      name: 'Pessoa Nova',
      email: `fechado-${Date.now()}@teste.local`,
      password: 'senha-de-teste-local-123',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) throw new Error('esperava recusa')
    expect(resultado.error).toContain('fechados')
  })

  it('recusa antes de tocar o banco', async () => {
    const { db } = await import('@/lib/db')
    const email = `nao-deve-existir-${Date.now()}@teste.local`

    await registerUser({ name: 'Pessoa', email, password: 'senha-de-teste-local-123' })

    // Nenhuma linha criada: a recusa acontece na porta, não depois de gravar.
    expect(await db.user.findUnique({ where: { email } })).toBeNull()
  })
})
