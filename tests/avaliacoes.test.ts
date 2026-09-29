import { describe, expect, it } from 'vitest'

import { avaliacaoPublica, questaoPublica, resumirTentativa } from '@/lib/avaliacoes'
import { getAssessments } from '@/lib/content/loader'
import { sugerirTrilha } from '@/lib/onboarding'
import { runStructuralChecks } from '@/lib/runner/structural'
import { capabilityFor } from '@/lib/runner'

/**
 * Avaliacoes, verificacao estrutural e recomendacao inicial.
 *
 * O teste mais importante deste arquivo e o primeiro: garantir que o gabarito
 * nao vaza para o navegador antes da resposta.
 */

describe('gabarito não chega ao navegador', () => {
  const avaliacoes = getAssessments()

  it('questão de alternativa vai sem resposta e sem explicação', () => {
    const questoes = avaliacoes
      .flatMap((avaliacao) => avaliacao.questions)
      .filter((questao) => questao.kind !== 'pratica')

    expect(questoes.length).toBeGreaterThan(0)

    for (const questao of questoes) {
      const publica = questaoPublica(questao) as Record<string, unknown>

      expect(publica.answerIndex).toBeUndefined()
      expect(publica.explanation).toBeUndefined()
      expect(publica.wrongExplanations).toBeUndefined()
      // As alternativas continuam indo: são o que a pessoa escolhe.
      expect(Array.isArray(publica.choices)).toBe(true)
    }
  })

  it('questão prática vai sem solução e sem os casos ocultos', () => {
    const praticas = avaliacoes
      .flatMap((avaliacao) => avaliacao.questions)
      .filter((questao) => questao.kind === 'pratica')

    expect(praticas.length).toBeGreaterThan(0)

    for (const questao of praticas) {
      const publica = questaoPublica(questao) as Record<string, unknown>
      expect(publica.solution).toBeUndefined()
    }

    const comOcultos = praticas.find(
      (questao) => questao.kind === 'pratica' && questao.tests.some((teste) => teste.hidden),
    )

    expect(comOcultos, 'nenhuma questão prática usa teste oculto').toBeDefined()

    if (comOcultos && comOcultos.kind === 'pratica') {
      const publica = questaoPublica(comOcultos)
      const visiveis = comOcultos.tests.filter((teste) => !teste.hidden).length

      expect(publica.tests).toHaveLength(visiveis)
      expect(publica.tests?.length).toBeLessThan(comOcultos.tests.length)
    }
  })

  it('a serialização da avaliação inteira não contém a chave answerIndex', () => {
    // Rede de segurança: se alguém adicionar um campo novo e esquecer de
    // filtrar, este teste acusa antes de virar gabarito no HTML.
    for (const avaliacao of avaliacoes) {
      const serializada = JSON.stringify(avaliacaoPublica(avaliacao))

      expect(serializada).not.toContain('answerIndex')
      expect(serializada).not.toContain('wrongExplanations')
    }
  })
})

describe('resumo da tentativa', () => {
  const avaliacao = getAssessments().find(
    (item) => item.format === 'alternativa' && item.questions.length >= 4,
  )!

  it('separa tópicos demonstrados dos que valem revisar', () => {
    const respostas = avaliacao.questions.map((questao, indice) => ({
      questionId: questao.id,
      correct: indice % 2 === 0,
    }))

    const resumo = resumirTentativa(avaliacao, respostas)

    expect(resumo.total).toEqual(respostas.length)
    expect(resumo.corretas).toEqual(respostas.filter((resposta) => resposta.correct).length)

    // Um tópico com qualquer erro vai para revisão e não aparece como domínio.
    const intersecao = resumo.topicosDemonstrados.filter((topico) =>
      resumo.topicosParaRevisar.includes(topico),
    )
    expect(intersecao).toEqual([])
  })

  it('acerto total não deixa nada para revisar', () => {
    const respostas = avaliacao.questions.map((questao) => ({ questionId: questao.id, correct: true }))
    const resumo = resumirTentativa(avaliacao, respostas)

    expect(resumo.topicosParaRevisar).toEqual([])
    expect(resumo.topicosDemonstrados.length).toBeGreaterThan(0)
  })

  it('erro total não deixa nada como domínio', () => {
    const respostas = avaliacao.questions.map((questao) => ({ questionId: questao.id, correct: false }))
    const resumo = resumirTentativa(avaliacao, respostas)

    expect(resumo.topicosDemonstrados).toEqual([])
    expect(resumo.topicosParaRevisar.length).toBeGreaterThan(0)
  })
})

describe('verificação estrutural', () => {
  it('encontra e não encontra o que deve', () => {
    const codigo = 'SELECT id FROM pedido WHERE status = :status LIMIT 50'

    const resultado = runStructuralChecks(codigo, [
      { name: 'tem limite', type: 'contains', value: 'LIMIT', caseSensitive: false },
      { name: 'sem select estrela', type: 'notContains', value: 'select *', caseSensitive: false },
      { name: 'usa parâmetro', type: 'regex', value: ':\\w+', caseSensitive: false },
    ])

    expect(resultado.map((caso) => caso.passed)).toEqual([true, true, true])
    expect(resultado.every((caso) => caso.mode === 'estrutura')).toBe(true)
  })

  it('reprova quando o padrão não aparece e devolve a dica', () => {
    const [caso] = runStructuralChecks('SELECT * FROM pedido', [
      { name: 'tem limite', type: 'contains', value: 'LIMIT', hint: 'Sem limite a tela quebra.', caseSensitive: false },
    ])

    expect(caso?.passed).toBe(false)
    expect(caso?.message).toEqual('Sem limite a tela quebra.')
  })

  it('respeita caseSensitive', () => {
    const [ignorando] = runStructuralChecks('limit 50', [
      { name: 'x', type: 'contains', value: 'LIMIT', caseSensitive: false },
    ])
    const [exigindo] = runStructuralChecks('limit 50', [
      { name: 'x', type: 'contains', value: 'LIMIT', caseSensitive: true },
    ])

    expect(ignorando?.passed).toBe(true)
    expect(exigindo?.passed).toBe(false)
  })

  it('conta apenas linhas com conteúdo em minLines', () => {
    const [caso] = runStructuralChecks('uma\n\n\ndois', [
      { name: 'duas linhas', type: 'minLines', value: '2', caseSensitive: false },
    ])

    expect(caso?.passed).toBe(true)
  })

  it('regex inválida reprova sem derrubar a execução', () => {
    const [caso] = runStructuralChecks('qualquer', [
      { name: 'quebrada', type: 'regex', value: '([', caseSensitive: false },
    ])

    expect(caso?.passed).toBe(false)
    expect(caso?.message).toContain('mal configurada')
  })
})

describe('escolha do modo de verificação', () => {
  const testes = [{ name: 'x', expression: 'f()', expected: 1, expectThrows: false, hidden: false }]

  it('JavaScript e TypeScript executam de verdade', () => {
    expect(capabilityFor('javascript', testes)).toEqual('execucao')
    expect(capabilityFor('typescript', testes)).toEqual('execucao')
  })

  it('Python executa sob confirmação', () => {
    expect(capabilityFor('python', testes)).toEqual('execucao-sob-demanda')
  })

  it('linguagem sem runtime cai em verificação estrutural', () => {
    expect(capabilityFor('sql', testes)).toEqual('estrutura')
    expect(capabilityFor('html', testes)).toEqual('estrutura')
  })

  it('sem testes, sempre estrutural', () => {
    expect(capabilityFor('javascript', [])).toEqual('estrutura')
  })
})

describe('trilha sugerida no início rápido', () => {
  it('quem nunca programou começa do zero', () => {
    const { trackId, motivo } = sugerirTrilha({
      hasProgrammedBefore: 'nunca',
      usedGit: 'nunca',
      usedDatabase: 'nunca',
    })

    expect(trackId).toEqual('comeco-do-zero')
    expect(motivo.length).toBeGreaterThan(10)
  })

  it('quem parou há tempo recomeça', () => {
    expect(
      sugerirTrilha({ hasProgrammedBefore: 'ja_programei', usedGit: 'pouco', usedDatabase: 'nunca' })
        .trackId,
    ).toEqual('recomecando')
  })

  it('quem já trabalha na área vai para backend', () => {
    expect(
      sugerirTrilha({ hasProgrammedBefore: 'trabalho_na_area', usedGit: 'sim', usedDatabase: 'sim' })
        .trackId,
    ).toEqual('foco-backend')
  })

  it('toda sugestão vem com motivo escrito', () => {
    const perfis = ['nunca', 'pouco', 'ja_programei', 'trabalho_na_area'] as const

    for (const perfil of perfis) {
      const { motivo } = sugerirTrilha({
        hasProgrammedBefore: perfil,
        usedGit: 'nunca',
        usedDatabase: 'nunca',
      })
      expect(motivo).toBeTruthy()
    }
  })
})
