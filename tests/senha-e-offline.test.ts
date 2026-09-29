import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Recuperacao de senha e sincronizacao offline.
 *
 * Os dois recursos tem a mesma exigencia central: nao vazar informacao e nao
 * perder nada. Aqui isso e verificado no comportamento, nao na implementacao.
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

// Nenhum teste pode disparar email de verdade.
const emailsEnviados: { para: string; assunto: string; texto: string }[] = []

vi.mock('@/lib/email', async () => {
  const original = await vi.importActual<typeof import('@/lib/email')>('@/lib/email')
  return {
    ...original,
    enviarEmail: async (email: { para: string; assunto: string; texto: string }) => {
      emailsEnviados.push(email)
      return { ok: true as const, transporte: 'console' as const }
    },
  }
})

const { db } = await import('@/lib/db')
const { loginUser, registerUser } = await import('@/lib/auth')
const { readSession } = await import('@/lib/session')
const { hashToken } = await import('@/lib/crypto')
const { pedirRedefinicao, redefinirSenha, tokenUtilizavel } = await import('@/lib/redefinicao-senha')
const { POST: rotaRecuperar } = await import('@/app/api/auth/recuperar/route')
const { POST: rotaProgresso } = await import('@/app/api/progresso/route')
const { GET: rotaConteudo } = await import('@/app/api/conteudo/modulo/[id]/route')
const { touchProgress } = await import('@/lib/progress')

const SENHA = 'senha-de-teste-local-123'
const SENHA_NOVA = 'senha-nova-de-teste-456'

let contador = 0

async function novoUsuario() {
  pote.clear()
  contador += 1
  const email = `senha-${contador}-${Date.now()}@teste.local`
  const resultado = await registerUser({ name: 'Pessoa', email, password: SENHA })
  if (!resultado.ok) throw new Error(resultado.error)
  return { ...resultado.user, email }
}

function pedido(corpo: unknown) {
  return new Request('http://localhost:3000/api/teste', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

const semParams = { params: Promise.resolve({} as Record<string, string>) }
const comParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

/** Extrai o token do link que foi para o email. */
function tokenDoUltimoEmail(): string {
  const ultimo = emailsEnviados.at(-1)
  if (!ultimo) throw new Error('nenhum email enviado')
  const achado = ultimo.texto.match(/token=([A-Za-z0-9_-]+)/)
  if (!achado?.[1]) throw new Error('link sem token')
  return achado[1]
}

beforeEach(() => {
  pote.clear()
  emailsEnviados.length = 0
})

afterAll(async () => {
  await db.$disconnect()
})

describe('pedido de redefinição', () => {
  it('envia o link para quem tem conta', async () => {
    const usuario = await novoUsuario()

    const resultado = await pedirRedefinicao(usuario.email)

    expect(resultado.detalhe).toEqual('enviado')
    expect(emailsEnviados).toHaveLength(1)
    expect(emailsEnviados[0]?.para).toEqual(usuario.email)
    expect(emailsEnviados[0]?.texto).toContain('/redefinir-senha?token=')
  })

  it('guarda apenas o hash do token, nunca o token do link', async () => {
    const usuario = await novoUsuario()
    await pedirRedefinicao(usuario.email)

    const token = tokenDoUltimoEmail()
    const registro = await db.passwordReset.findFirst({ where: { userId: usuario.id } })

    expect(registro).not.toBeNull()
    expect(registro?.tokenHash).not.toEqual(token)
    expect(registro?.tokenHash).toEqual(hashToken(token))
  })

  it('não revela se o email tem conta', async () => {
    const usuario = await novoUsuario()

    const comConta = await rotaRecuperar(pedido({ email: usuario.email }), semParams)
    const semConta = await rotaRecuperar(pedido({ email: 'ninguem-mesmo@teste.local' }), semParams)

    expect(comConta.status).toEqual(semConta.status)

    const corpoA = (await comConta.json()) as { mensagem: string }
    const corpoB = (await semConta.json()) as { mensagem: string }

    // Mesma mensagem, mesmo status: a tela não serve para descobrir cadastros.
    expect(corpoA.mensagem).toEqual(corpoB.mensagem)
  })

  it('email sem conta não cria token nenhum', async () => {
    const antes = await db.passwordReset.count()

    const resultado = await pedirRedefinicao('nao-existe-de-jeito-nenhum@teste.local')

    expect(resultado.detalhe).toEqual('conta-inexistente')
    expect(emailsEnviados).toHaveLength(0)
    expect(await db.passwordReset.count()).toEqual(antes)
  })

  it('um pedido novo invalida o link anterior', async () => {
    const usuario = await novoUsuario()

    await pedirRedefinicao(usuario.email)
    const primeiro = tokenDoUltimoEmail()

    await pedirRedefinicao(usuario.email)
    const segundo = tokenDoUltimoEmail()

    expect(primeiro).not.toEqual(segundo)
    expect(await tokenUtilizavel(primeiro)).toBe(false)
    expect(await tokenUtilizavel(segundo)).toBe(true)
  })
})

describe('uso do link', () => {
  it('troca a senha e encerra as sessões abertas', async () => {
    const usuario = await novoUsuario()

    // Duas sessões, como se fossem dois aparelhos.
    await loginUser({ email: usuario.email, password: SENHA })
    await loginUser({ email: usuario.email, password: SENHA })
    expect(await db.session.count({ where: { userId: usuario.id, revokedAt: null } })).toBeGreaterThan(1)

    await pedirRedefinicao(usuario.email)
    const resultado = await redefinirSenha(tokenDoUltimoEmail(), SENHA_NOVA)

    expect(resultado.ok).toBe(true)

    // Nenhuma sessão sobrevive: quem redefine costuma desconfiar de invasão.
    expect(await db.session.count({ where: { userId: usuario.id, revokedAt: null } })).toEqual(0)
    expect(await readSession()).toBeNull()

    const comNova = await loginUser({ email: usuario.email, password: SENHA_NOVA })
    expect(comNova.ok).toBe(true)

    pote.clear()
    const comAntiga = await loginUser({ email: usuario.email, password: SENHA })
    expect(comAntiga.ok).toBe(false)
  })

  it('o link só funciona uma vez', async () => {
    const usuario = await novoUsuario()
    await pedirRedefinicao(usuario.email)
    const token = tokenDoUltimoEmail()

    const primeira = await redefinirSenha(token, SENHA_NOVA)
    const segunda = await redefinirSenha(token, 'outra-senha-ainda-999')

    expect(primeira.ok).toBe(true)
    expect(segunda.ok).toBe(false)

    // A segunda tentativa não pode ter trocado a senha de novo.
    const confere = await loginUser({ email: usuario.email, password: SENHA_NOVA })
    expect(confere.ok).toBe(true)
  })

  it('link vencido não vale', async () => {
    const usuario = await novoUsuario()
    await pedirRedefinicao(usuario.email)
    const token = tokenDoUltimoEmail()

    await db.passwordReset.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    expect(await tokenUtilizavel(token)).toBe(false)

    const resultado = await redefinirSenha(token, SENHA_NOVA)
    expect(resultado.ok).toBe(false)
  })

  it('token inventado não vale e não diz por quê', async () => {
    const inexistente = await redefinirSenha('token-que-nunca-existiu-1234567890', SENHA_NOVA)

    expect(inexistente.ok).toBe(false)
    if (!inexistente.ok) {
      // Mesma mensagem de vencido/usado: não dá pistas a quem tenta adivinhar.
      expect(inexistente.erro).toContain('não vale mais')
    }
  })

  it('excluir a conta leva os pedidos junto', async () => {
    const usuario = await novoUsuario()
    await pedirRedefinicao(usuario.email)

    expect(await db.passwordReset.count({ where: { userId: usuario.id } })).toEqual(1)

    await db.user.delete({ where: { id: usuario.id } })

    expect(await db.passwordReset.count({ where: { userId: usuario.id } })).toEqual(0)
  })
})

describe('conteúdo para leitura offline', () => {
  it('devolve o módulo com itens e glossário', async () => {
    await novoUsuario()

    const resposta = await rotaConteudo(
      new Request('http://localhost:3000/api/conteudo/modulo/pensamento-computacional'),
      comParams({ id: 'pensamento-computacional' }),
    )

    expect(resposta.status).toEqual(200)

    const corpo = (await resposta.json()) as {
      modulo: { id: string; items: unknown[] }
      glossario: unknown[]
    }

    expect(corpo.modulo.id).toEqual('pensamento-computacional')
    expect(corpo.modulo.items.length).toBeGreaterThan(0)
    expect(corpo.glossario.length).toBeGreaterThan(0)
  })

  it('não carrega nenhum dado de usuário junto', async () => {
    const usuario = await novoUsuario()

    await rotaProgresso(
      pedido({ acao: 'concluir', tipo: 'lesson', id: 'pc-programar-e-instruir-01' }),
      semParams,
    )

    const resposta = await rotaConteudo(
      new Request('http://localhost:3000/api/conteudo/modulo/pensamento-computacional'),
      comParams({ id: 'pensamento-computacional' }),
    )

    const texto = await resposta.text()

    // O que vai para o cache do aparelho é currículo, e só currículo.
    expect(texto).not.toContain(usuario.id)
    expect(texto).not.toContain(usuario.email)
    expect(texto).not.toContain('completed')
  })

  it('exige sessão', async () => {
    pote.clear()

    const resposta = await rotaConteudo(
      new Request('http://localhost:3000/api/conteudo/modulo/pensamento-computacional'),
      comParams({ id: 'pensamento-computacional' }),
    )

    expect(resposta.status).toEqual(401)
  })

  it('módulo inexistente devolve 404', async () => {
    await novoUsuario()

    const resposta = await rotaConteudo(
      new Request('http://localhost:3000/api/conteudo/modulo/nao-existe'),
      comParams({ id: 'nao-existe' }),
    )

    expect(resposta.status).toEqual(404)
  })
})

describe('sincronização do que foi feito offline', () => {
  it('conclusão guardada offline sobe e vale', async () => {
    const usuario = await novoUsuario()

    // Como a fila envia: mesma rota, com o momento em que aconteceu.
    const resposta = await rotaProgresso(
      pedido({
        acao: 'concluir',
        tipo: 'lesson',
        id: 'pc-decomposicao-01',
        moduloId: 'pensamento-computacional',
        segundos: 240,
        ocorridoEm: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
      semParams,
    )

    expect(resposta.status).toEqual(200)

    const progresso = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: {
          userId: usuario.id,
          nodeType: 'lesson',
          nodeId: 'pc-decomposicao-01',
        },
      },
    })

    expect(progresso?.status).toEqual('completed')
    expect(progresso?.secondsSpent).toEqual(240)
  })

  it('reenviar o mesmo evento não duplica a conclusão', async () => {
    const usuario = await novoUsuario()

    const evento = {
      acao: 'concluir',
      tipo: 'lesson',
      id: 'pc-abstracao-01',
      moduloId: 'pensamento-computacional',
      segundos: 0,
      ocorridoEm: new Date().toISOString(),
    }

    await rotaProgresso(pedido(evento), semParams)
    const primeira = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'pc-abstracao-01' },
      },
    })

    await rotaProgresso(pedido(evento), semParams)
    const depois = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'pc-abstracao-01' },
      },
    })

    expect(depois?.completedAt?.getTime()).toEqual(primeira?.completedAt?.getTime())

    // E o dia continua contando uma conclusão só.
    const dias = await db.activity.findMany({ where: { userId: usuario.id } })
    expect(dias[0]?.lessonsCompleted).toEqual(1)
  })

  it('evento antigo não move o ponto de parada para trás', async () => {
    const usuario = await novoUsuario()
    const comum = {
      userId: usuario.id,
      nodeType: 'lesson' as const,
      nodeId: 'python-loops-01',
      moduleId: 'python',
    }

    // Estado atual: parou no bloco 8.
    await touchProgress({ ...comum, resumeBlock: 8 })

    // Chega um evento offline de uma hora atrás, do bloco 2.
    await touchProgress({
      ...comum,
      resumeBlock: 2,
      addSeconds: 120,
      occurredAt: new Date(Date.now() - 60 * 60 * 1000),
    })

    const progresso = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'python-loops-01' },
      },
    })

    // O ponto de parada fica onde estava; o tempo estudado soma, porque aconteceu.
    expect(progresso?.resumeBlock).toEqual(8)
    expect(progresso?.secondsSpent).toEqual(120)
  })

  it('evento mais recente move o ponto de parada normalmente', async () => {
    const usuario = await novoUsuario()
    const comum = {
      userId: usuario.id,
      nodeType: 'lesson' as const,
      nodeId: 'python-funcoes-01',
      moduleId: 'python',
    }

    await touchProgress({ ...comum, resumeBlock: 2 })
    await touchProgress({ ...comum, resumeBlock: 9, occurredAt: new Date(Date.now() + 1000) })

    const progresso = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'python-funcoes-01' },
      },
    })

    expect(progresso?.resumeBlock).toEqual(9)
  })
})
