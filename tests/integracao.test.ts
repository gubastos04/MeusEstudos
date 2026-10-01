import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Fluxo completo e isolamento entre usuarios.
 *
 * Cobre o caminho da spec:
 *   cadastro -> login -> iniciar modulo -> concluir bloco -> sair ->
 *   entrar de outro dispositivo -> progresso preservado
 *
 * Alem disso, o que nao pode regredir nunca: um usuario nao alcanca dado de
 * outro, o gabarito e aplicado no servidor e a IA desligada nao faz chamada.
 *
 * `next/headers` e substituido por um pote de cookies em memoria — e a unica
 * parte do Next que a camada de sessao toca.
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
const { loginUser, registerUser } = await import('@/lib/auth')
const { destroySession, readSession, SESSION_COOKIE } = await import('@/lib/session')
const { POST: rotaProgresso } = await import('@/app/api/progresso/route')
const { POST: rotaAnotacoes, GET: rotaListarAnotacoes } = await import('@/app/api/anotacoes/route')
const { PATCH: rotaEditarAnotacao, DELETE: rotaExcluirAnotacao } = await import(
  '@/app/api/anotacoes/[id]/route'
)
const { POST: rotaAvaliacao } = await import('@/app/api/avaliacoes/[id]/route')
const { POST: rotaIa } = await import('@/app/api/ia/route')
const { getAssessments } = await import('@/lib/content/loader')

const SENHA = 'senha-de-teste-local-123'

function pedido(corpo: unknown, opcoes: { origin?: string } = {}) {
  return new Request('http://localhost:3000/api/teste', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opcoes.origin ? { origin: opcoes.origin, host: 'localhost:3000' } : {}),
    },
    body: JSON.stringify(corpo),
  })
}

const semParams = { params: Promise.resolve({} as Record<string, string>) }
const comParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

async function criarUsuario(email: string, nome = 'Pessoa de Teste') {
  const resultado = await registerUser({ name: nome, email, password: SENHA })
  if (!resultado.ok) throw new Error(`falha ao criar ${email}: ${resultado.error}`)
  return resultado.user
}

/** Troca a sessão ativa, como se fosse outro navegador. */
async function entrarComo(email: string) {
  pote.clear()
  const resultado = await loginUser({ email, password: SENHA })
  if (!resultado.ok) throw new Error(`falha ao entrar como ${email}: ${resultado.error}`)
  return resultado.user
}

beforeEach(() => {
  pote.clear()
})

afterAll(async () => {
  await db.$disconnect()
})

describe('cadastro e login', () => {
  it('cria conta com perfil e configuração de IA, e deixa a sessão ativa', async () => {
    const usuario = await criarUsuario('cadastro@teste.local', 'Ana Cadastro')

    expect(usuario.email).toEqual('cadastro@teste.local')
    expect(usuario.onboardedAt).toBeNull()

    const registro = await db.user.findUnique({
      where: { id: usuario.id },
      include: { profile: true, aiConfig: true },
    })

    expect(registro?.profile).not.toBeNull()
    expect(registro?.aiConfig).not.toBeNull()
    expect(registro?.passwordHash).not.toContain(SENHA)

    // O cookie existe e o banco guarda apenas o hash do token.
    const token = pote.get(SESSION_COOKIE)
    expect(token).toBeTruthy()

    const sessoes = await db.session.findMany({ where: { userId: usuario.id } })
    expect(sessoes).toHaveLength(1)
    expect(sessoes[0]?.tokenHash).not.toEqual(token)
  })

  it('recusa email repetido', async () => {
    await criarUsuario('repetido@teste.local')
    const segundo = await registerUser({ name: 'Outra', email: 'repetido@teste.local', password: SENHA })

    expect(segundo.ok).toBe(false)
  })

  it('usa a mesma mensagem para senha errada e email inexistente', async () => {
    await criarUsuario('mensagem@teste.local')

    const senhaErrada = await loginUser({ email: 'mensagem@teste.local', password: 'outra-senha-aqui' })
    const emailInexistente = await loginUser({ email: 'ninguem@teste.local', password: SENHA })

    expect(senhaErrada.ok).toBe(false)
    expect(emailInexistente.ok).toBe(false)

    if (!senhaErrada.ok && !emailInexistente.ok) {
      // Mensagens diferentes permitiriam descobrir quais emails têm conta.
      expect(senhaErrada.error).toEqual(emailInexistente.error)
    }
  })

  it('sair invalida a sessão no servidor', async () => {
    await criarUsuario('sair@teste.local')
    expect(await readSession()).not.toBeNull()

    await destroySession()

    expect(await readSession()).toBeNull()
    expect(pote.has(SESSION_COOKIE)).toBe(false)
  })
})

describe('progresso entre dispositivos', () => {
  it('conclui um bloco, sai, entra de novo e o progresso continua lá', async () => {
    const usuario = await criarUsuario('dispositivos@teste.local')

    const iniciar = await rotaProgresso(
      pedido({
        acao: 'iniciar',
        tipo: 'lesson',
        id: 'pc-programar-e-instruir-01',
        moduloId: 'pensamento-computacional',
      }),
      semParams,
    )
    expect(iniciar.status).toEqual(200)

    const concluir = await rotaProgresso(
      pedido({
        acao: 'concluir',
        tipo: 'lesson',
        id: 'pc-programar-e-instruir-01',
        moduloId: 'pensamento-computacional',
        segundos: 300,
      }),
      semParams,
    )
    expect(concluir.status).toEqual(200)

    // Sai daqui e entra "de outro dispositivo": sessão nova, dados iguais.
    await destroySession()
    await entrarComo('dispositivos@teste.local')

    const sessao = await readSession()
    expect(sessao?.id).toEqual(usuario.id)

    const progresso = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: {
          userId: usuario.id,
          nodeType: 'lesson',
          nodeId: 'pc-programar-e-instruir-01',
        },
      },
    })

    expect(progresso?.status).toEqual('completed')
    expect(progresso?.secondsSpent).toEqual(300)
  })

  it('reabrir conteúdo concluído não rebaixa o progresso', async () => {
    const usuario = await criarUsuario('naovolta@teste.local')

    await rotaProgresso(
      pedido({ acao: 'concluir', tipo: 'lesson', id: 'pc-decomposicao-01' }),
      semParams,
    )

    const primeira = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'pc-decomposicao-01' },
      },
    })

    await rotaProgresso(pedido({ acao: 'iniciar', tipo: 'lesson', id: 'pc-decomposicao-01' }), semParams)

    const depois = await db.progress.findUnique({
      where: {
        userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'pc-decomposicao-01' },
      },
    })

    expect(depois?.status).toEqual('completed')
    // A primeira conclusão é preservada: refazer não reescreve a história.
    expect(depois?.completedAt?.getTime()).toEqual(primeira?.completedAt?.getTime())
  })

  it('registra o dia como ativo, sem streak', async () => {
    const usuario = await criarUsuario('atividade@teste.local')

    await rotaProgresso(pedido({ acao: 'concluir', tipo: 'lesson', id: 'pc-abstracao-01' }), semParams)

    const dias = await db.activity.findMany({ where: { userId: usuario.id } })

    expect(dias).toHaveLength(1)
    expect(dias[0]?.lessonsCompleted).toEqual(1)
  })

  it('recusa progresso para conteúdo inexistente', async () => {
    await criarUsuario('inexistente@teste.local')

    const resposta = await rotaProgresso(
      pedido({ acao: 'concluir', tipo: 'lesson', id: 'nao-existe-mesmo' }),
      semParams,
    )

    expect(resposta.status).toEqual(404)
  })
})

describe('isolamento entre usuários', () => {
  it('a anotação de um não aparece nem pode ser alterada pelo outro', async () => {
    const ana = await criarUsuario('ana@isolamento.local', 'Ana')
    const bruno = await criarUsuario('bruno@isolamento.local', 'Bruno')

    // Ana cria uma anotação.
    await entrarComo('ana@isolamento.local')
    const criada = await rotaAnotacoes(
      pedido({ titulo: 'Anotação da Ana', corpo: 'conteúdo privado' }),
      semParams,
    )
    expect(criada.status).toEqual(201)
    const { id } = (await criada.json()) as { id: string }

    // Bruno não vê.
    await entrarComo('bruno@isolamento.local')
    const lista = (await (await rotaListarAnotacoes(
      new Request('http://localhost:3000/api/anotacoes'),
      semParams,
    )).json()) as { anotacoes: { id: string }[] }

    expect(lista.anotacoes.some((anotacao) => anotacao.id === id)).toBe(false)

    // Bruno não altera nem apaga, mesmo com o id em mãos.
    const tentativaEdicao = await rotaEditarAnotacao(
      new Request('http://localhost:3000/api/anotacoes/x', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ titulo: 'invadida' }),
      }),
      comParams({ id }),
    )
    expect(tentativaEdicao.status).toEqual(404)

    const tentativaExclusao = await rotaExcluirAnotacao(
      new Request('http://localhost:3000/api/anotacoes/x', { method: 'DELETE' }),
      comParams({ id }),
    )
    expect(tentativaExclusao.status).toEqual(404)

    // E a anotação continua intacta para a dona.
    const original = await db.note.findUnique({ where: { id } })
    expect(original?.title).toEqual('Anotação da Ana')
    expect(original?.userId).toEqual(ana.id)
    expect(original?.userId).not.toEqual(bruno.id)
  })

  it('sem sessão, rota de dado devolve 401', async () => {
    pote.clear()

    const resposta = await rotaAnotacoes(pedido({ titulo: 'sem sessão' }), semParams)

    expect(resposta.status).toEqual(401)
  })

  it('recusa requisição vinda de outra origem', async () => {
    await criarUsuario('csrf@teste.local')

    const resposta = await rotaAnotacoes(
      pedido({ titulo: 'de fora' }, { origin: 'https://site-malicioso.example' }),
      semParams,
    )

    expect(resposta.status).toEqual(403)
  })
})

describe('avaliação corrigida no servidor', () => {
  const avaliacao = getAssessments().find((item) => item.format === 'alternativa')!

  it('corrige a alternativa e só então devolve a explicação', async () => {
    const usuario = await criarUsuario('avaliacao@teste.local')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: avaliacao.id }))
    expect(inicio.status).toEqual(201)
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    const questao = avaliacao.questions[0]!
    if (questao.kind === 'pratica') throw new Error('esperava questão de alternativa')

    const errada = (questao.answerIndex + 1) % questao.choices.length

    const resposta = await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: questao.id, escolha: errada }),
      comParams({ id: avaliacao.id }),
    )

    const dados = (await resposta.json()) as {
      correta: boolean
      indiceCorreto: number
      explicacao: string
    }

    expect(dados.correta).toBe(false)
    expect(dados.indiceCorreto).toEqual(questao.answerIndex)
    expect(dados.explicacao).toBeTruthy()

    // A resposta enviada pelo cliente não decide nada: o registro segue o
    // gabarito do servidor.
    const registro = await db.answer.findFirst({ where: { attemptId: tentativaId } })
    expect(registro?.correct).toBe(false)
    expect(registro?.userId).toEqual(usuario.id)
  })

  it('não aceita responder a mesma questão duas vezes', async () => {
    await criarUsuario('duasvezes@teste.local')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: avaliacao.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    const questao = avaliacao.questions[0]!
    if (questao.kind === 'pratica') throw new Error('esperava questão de alternativa')

    await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: questao.id, escolha: questao.answerIndex }),
      comParams({ id: avaliacao.id }),
    )

    const repetida = await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: questao.id, escolha: 0 }),
      comParams({ id: avaliacao.id }),
    )

    expect(repetida.status).toEqual(409)
  })

  it('não permite responder numa tentativa de outro usuário', async () => {
    await criarUsuario('dono@avaliacao.local')
    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: avaliacao.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    await criarUsuario('intruso@avaliacao.local')

    const questao = avaliacao.questions[0]!
    const resposta = await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: questao.id, escolha: 0 }),
      comParams({ id: avaliacao.id }),
    )

    expect(resposta.status).toEqual(404)
  })

  it('tentativas anteriores não são apagadas', async () => {
    const usuario = await criarUsuario('historico@avaliacao.local')

    await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: avaliacao.id }))
    await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: avaliacao.id }))

    const tentativas = await db.assessmentAttempt.findMany({
      where: { userId: usuario.id, assessmentId: avaliacao.id },
      orderBy: { attemptNumber: 'asc' },
    })

    expect(tentativas.map((tentativa) => tentativa.attemptNumber)).toEqual([1, 2])
  })
})

describe('IA desligada', () => {
  it('avisa e não gasta nenhuma chamada quando não há chave', async () => {
    const usuario = await criarUsuario('ia@teste.local')

    const resposta = await rotaIa(
      pedido({ feature: 'pergunta', context: {}, input: 'como funciona um índice?' }),
      semParams,
    )

    expect(resposta.status).toEqual(503)

    const corpo = (await resposta.json()) as { erro: string }
    expect(corpo.erro).toContain('não está configurada')

    // O ponto central: nenhuma chamada foi contabilizada, então não há custo.
    const consumo = await db.aIUsage.findMany({ where: { userId: usuario.id } })
    expect(consumo.every((dia) => dia.calls === 0)).toBe(true)

    // E a tentativa fica registrada como "sem-chave", para o consumo ser auditável.
    const registro = await db.aIRequest.findFirst({ where: { userId: usuario.id } })
    expect(registro?.status).toEqual('sem-chave')
  })
})

describe('avaliação sob tentativa de burla', () => {
  const alternativa = getAssessments().find((item) => item.format === 'alternativa')!
  const pratica = getAssessments().find((item) =>
    item.questions.some((questao) => questao.kind === 'pratica'),
  )!

  it('não responde mais numa tentativa finalizada', async () => {
    await criarUsuario('finalizada@teste.local')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: alternativa.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    await rotaAvaliacao(pedido({ acao: 'finalizar', tentativaId }), comParams({ id: alternativa.id }))

    const questao = alternativa.questions[0]!
    const depois = await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: questao.id, escolha: 0 }),
      comParams({ id: alternativa.id }),
    )

    expect(depois.status).toEqual(409)
  })

  it('não finaliza duas vezes', async () => {
    await criarUsuario('duplo-fim@teste.local')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: alternativa.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    const primeira = await rotaAvaliacao(
      pedido({ acao: 'finalizar', tentativaId }),
      comParams({ id: alternativa.id }),
    )
    const segunda = await rotaAvaliacao(
      pedido({ acao: 'finalizar', tentativaId }),
      comParams({ id: alternativa.id }),
    )

    expect(primeira.status).toEqual(200)
    expect(segunda.status).toEqual(409)
  })

  it('não usa a tentativa de uma avaliação para responder outra', async () => {
    await criarUsuario('troca-avaliacao@teste.local')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: alternativa.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    // Mesmo usuário, mesma tentativa, outra avaliação na URL.
    const outra = getAssessments().find((item) => item.id !== alternativa.id)!
    const resposta = await rotaAvaliacao(
      pedido({ acao: 'responder', tentativaId, questaoId: outra.questions[0]!.id, escolha: 0 }),
      comParams({ id: outra.id }),
    )

    expect(resposta.status).toEqual(404)
  })

  it('questão prática não registra mais casos passados do que existem', async () => {
    await criarUsuario('inflar-casos@teste.local')

    const questao = pratica.questions.find((item) => item.kind === 'pratica')!
    if (questao.kind !== 'pratica') throw new Error('esperava questão prática')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: pratica.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    await rotaAvaliacao(
      pedido({
        acao: 'responder',
        tentativaId,
        questaoId: questao.id,
        codigo: 'def total(itens): return 0',
        passouTestes: true,
        // Números impossíveis, como um cliente modificado mandaria.
        casosPassaram: 99,
        totalCasos: 0,
      }),
      comParams({ id: pratica.id }),
    )

    const registro = await db.answer.findFirst({ where: { attemptId: tentativaId } })

    // O servidor sabe quantos casos a questão tem: o cliente não decide isso.
    expect(registro?.totalCases).toEqual(questao.tests.length)
    expect(registro?.passedCases).toBeLessThanOrEqual(registro?.totalCases ?? 0)
  })

  it('resultado parcial honesto é guardado como veio', async () => {
    await criarUsuario('parcial@teste.local')

    const questao = pratica.questions.find((item) => item.kind === 'pratica')!
    if (questao.kind !== 'pratica') throw new Error('esperava questão prática')

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: pratica.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    await rotaAvaliacao(
      pedido({
        acao: 'responder',
        tentativaId,
        questaoId: questao.id,
        codigo: 'def total(itens): return 1',
        passouTestes: false,
        casosPassaram: 3,
      }),
      comParams({ id: pratica.id }),
    )

    const registro = await db.answer.findFirst({ where: { attemptId: tentativaId } })

    // O limite existe para barrar número impossível, não para achatar o que é
    // verdade: três de cinco continua três.
    expect(registro?.passedCases).toEqual(3)
    expect(registro?.totalCases).toEqual(questao.tests.length)
    expect(registro?.correct).toBe(false)
  })

  it('o registro diz que a execução foi informada pelo navegador', async () => {
    await criarUsuario('execucao-informada@teste.local')

    const questao = pratica.questions.find((item) => item.kind === 'pratica')!

    const inicio = await rotaAvaliacao(pedido({ acao: 'iniciar' }), comParams({ id: pratica.id }))
    const { tentativaId } = (await inicio.json()) as { tentativaId: string }

    await rotaAvaliacao(
      pedido({
        acao: 'responder',
        tentativaId,
        questaoId: questao.id,
        codigo: 'def total(itens): return 0',
        passouTestes: true,
        casosPassaram: 5,
        totalCasos: 5,
      }),
      comParams({ id: pratica.id }),
    )

    const registro = await db.answer.findFirst({ where: { attemptId: tentativaId } })

    // O código de quem estuda nunca roda no servidor, então o resultado dos
    // testes chega do navegador. O registro não pode confundir isso com
    // verificação feita aqui — é a regra 9 do produto aplicada ao dado.
    expect(registro?.report).toContain('execucao-informada')
  })
})
