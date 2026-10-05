import { describe, expect, it } from 'vitest'

import { reloadContent } from '@/lib/content/loader'
import { stripTypes } from '@/lib/runner/run-js'

/**
 * Conteudo.
 *
 * Estes testes substituem a revisao manual de /content e rodam em CI: qualquer
 * arquivo novo passa pelas mesmas regras de produto, nao so pelo schema.
 */

const conteudo = reloadContent()

describe('carregamento', () => {
  it('não encontra nenhum problema em /content', () => {
    // Mensagem explícita: um erro aqui precisa dizer qual arquivo e por quê.
    expect(conteudo.issues.map((problema) => `${problema.file}: ${problema.message}`)).toEqual([])
  })

  it('carrega os quatro semestres', () => {
    const semestres = new Set(conteudo.modules.map((modulo) => modulo.semester))
    expect([...semestres].sort()).toEqual([1, 2, 3, 4])
  })

  it('carrega demandas, projetos, desafios, glossário e trilhas', () => {
    expect(conteudo.demands.length).toBeGreaterThan(0)
    expect(conteudo.projects.length).toBeGreaterThan(0)
    expect(conteudo.challenges.length).toBeGreaterThan(0)
    expect(conteudo.glossary.length).toBeGreaterThan(0)
    expect(conteudo.tracks.length).toBeGreaterThan(0)
  })
})

describe('regras de produto', () => {
  it('nenhum item passa de 20 minutos', () => {
    const longos = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .filter((item) => item.estimatedMinutes > 20)
      .map((item) => `${item.id} (${item.estimatedMinutes} min)`)

    expect(longos).toEqual([])
  })

  it('todo módulo tem prática', () => {
    const semPratica = conteudo.modules
      .filter((modulo) => {
        const aulas = modulo.items.filter((item) => item.type === 'lesson')
        if (aulas.length === 0) return false
        return !aulas.some((item) => item.type === 'lesson' && (item.exercise || item.tryNow))
      })
      .map((modulo) => modulo.id)

    expect(semPratica).toEqual([])
  })

  it('toda aula responde por que existe e o que a pessoa vai fazer', () => {
    const incompletas = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .filter((item) => item.type === 'lesson' && (!item.why.trim() || !item.goal.trim()))
      .map((item) => item.id)

    expect(incompletas).toEqual([])
  })

  it('exercício de código tem testes ou verificações', () => {
    const semVerificacao = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .flatMap((item) => (item.type === 'lesson' && item.exercise ? [item.exercise] : []))
      .filter(
        (exercicio) =>
          exercicio.kind === 'code' && exercicio.tests.length === 0 && exercicio.checks.length === 0,
      )
      .map((exercicio) => exercicio.id)

    expect(semVerificacao).toEqual([])
  })

  it('exercício que recebe coleção cobre a coleção vazia', () => {
    // O caso vazio é o de borda mais esquecido e o que mais vira bug real.
    // A regra só se aplica a quem recebe coleção: exercício sobre classe ou
    // sobre valores escalares não tem "vazio" para cobrir.
    const recebeColecao = (expressao: string) => /\(\s*\[/.test(expressao)
    // A coleção vazia pode estar em qualquer posição de argumento.
    const cobreVazio = (expressao: string) => /\[\s*\]/.test(expressao)

    const semCasoVazio = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .flatMap((item) => (item.type === 'lesson' && item.exercise ? [item.exercise] : []))
      .filter((exercicio) => exercicio.kind === 'code' && exercicio.tests.length > 0)
      .filter((exercicio) => exercicio.tests.some((teste) => recebeColecao(teste.expression)))
      .filter((exercicio) => !exercicio.tests.some((teste) => cobreVazio(teste.expression)))
      .map((exercicio) => exercicio.id)

    expect(semCasoVazio).toEqual([])
  })

  it('exercício de código tem mais de um caso de teste', () => {
    // Um único caso feliz não verifica nada: o exercício precisa de borda.
    const rasos = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .flatMap((item) => (item.type === 'lesson' && item.exercise ? [item.exercise] : []))
      .filter((exercicio) => exercicio.kind === 'code')
      .filter((exercicio) => exercicio.tests.length + exercicio.checks.length < 3)
      .map((exercicio) => exercicio.id)

    expect(rasos).toEqual([])
  })
})

describe('integridade de referências', () => {
  it('ids de item são únicos em todo o currículo', () => {
    const ids = conteudo.modules.flatMap((modulo) => modulo.items.map((item) => item.id))
    const repetidos = ids.filter((id, indice) => ids.indexOf(id) !== indice)

    expect(repetidos).toEqual([])
  })

  it('answerIndex sempre aponta para uma alternativa existente', () => {
    const invalidos: string[] = []

    for (const modulo of conteudo.modules) {
      for (const avaliacao of modulo.assessments) {
        for (const questao of avaliacao.questions) {
          if (questao.kind === 'pratica') continue
          if (questao.answerIndex >= questao.choices.length) invalidos.push(questao.id)
        }
      }
    }

    expect(invalidos).toEqual([])
  })

  it('avaliação de alternativa não mistura questão prática', () => {
    const misturadas = conteudo.modules
      .flatMap((modulo) => modulo.assessments)
      .filter((avaliacao) =>
        avaliacao.format === 'alternativa'
          ? avaliacao.questions.some((questao) => questao.kind === 'pratica')
          : avaliacao.questions.some((questao) => questao.kind !== 'pratica'),
      )
      .map((avaliacao) => avaliacao.id)

    expect(misturadas).toEqual([])
  })

  it('termo de glossário citado numa aula existe', () => {
    const existentes = new Set(
      conteudo.glossary.flatMap((termo) => [termo.id.toLowerCase(), termo.term.toLowerCase()]),
    )

    const quebrados = conteudo.modules
      .flatMap((modulo) => modulo.items)
      .flatMap((item) => (item.type === 'lesson' ? item.glossary : []))
      .filter((referencia) => !existentes.has(referencia.toLowerCase()))

    expect(quebrados).toEqual([])
  })

  it('demanda aponta apenas para módulos existentes', () => {
    const modulos = new Set(conteudo.modules.map((modulo) => modulo.id))
    const quebradas = conteudo.demands
      .flatMap((demanda) => demanda.moduleIds.map((id) => `${demanda.id} -> ${id}`))
      .filter((par) => !modulos.has(par.split(' -> ')[1] ?? ''))

    expect(quebradas).toEqual([])
  })

  it('trilha aponta apenas para módulos existentes', () => {
    const modulos = new Set(conteudo.modules.map((modulo) => modulo.id))
    const quebradas = conteudo.tracks
      .flatMap((trilha) => trilha.moduleIds.map((id) => `${trilha.id} -> ${id}`))
      .filter((par) => !modulos.has(par.split(' -> ')[1] ?? ''))

    expect(quebradas).toEqual([])
  })

  it('projeto tem etapas em ordem contínua', () => {
    const foraDeOrdem = conteudo.projects
      .filter((projeto) =>
        projeto.steps.some((etapa, indice) => etapa.order !== indice + 1),
      )
      .map((projeto) => projeto.id)

    expect(foraDeOrdem).toEqual([])
  })
})

describe('a solução oficial resolve o próprio exercício', () => {
  /**
   * Executa a solucao contra os testes do proprio exercicio.
   *
   * E a unica verificacao que prova que o exercicio funciona: schema e regra
   * de produto nao pegam um caso de teste com valor errado, e quem estuda
   * levaria a culpa por um defeito do conteudo.
   *
   * Replica js-worker-source.ts: mesma construcao por new Function com eval
   * por expressao, e o mesmo deepEqual com tolerancia de ponto flutuante.
   * Python fica de fora — depende do Pyodide, que so existe no navegador.
   */
  function iguais(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (typeof a === 'number' && typeof b === 'number') {
      if (Number.isNaN(a) && Number.isNaN(b)) return true
      if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) < 1e-9
      return false
    }
    if (a === null || b === null || a === undefined || b === undefined) return false
    if (typeof a !== typeof b || typeof a !== 'object') return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    if (Array.isArray(a)) {
      const outro = b as unknown[]
      return a.length === outro.length && a.every((item, i) => iguais(item, outro[i]))
    }
    const ca = a as Record<string, unknown>
    const cb = b as Record<string, unknown>
    const chaves = Object.keys(ca)
    if (chaves.length !== Object.keys(cb).length) return false
    return chaves.every((k) => Object.prototype.hasOwnProperty.call(cb, k) && iguais(ca[k], cb[k]))
  }

  type Caso = { name: string; expression: string; expected?: unknown; expectThrows?: boolean }

  function rodar(codigo: string, linguagem: string, casos: Caso[]): string[] {
    const fonte = linguagem === 'typescript' ? stripTypes(codigo) : codigo
    const mudo = { log() {}, info() {}, warn() {}, error() {}, debug() {}, table() {} }

    let avaliar: (expressao: string) => unknown
    try {
      const fabrica = new Function(
        'console',
        '"use strict";\n' + fonte + '\n;return function (__expressao) { return eval(__expressao); };',
      )
      avaliar = fabrica(mudo) as (e: string) => unknown
    } catch (erro) {
      return ['a solução não carrega: ' + (erro as Error).message]
    }

    const falhas: string[] = []
    for (const caso of casos) {
      try {
        const recebido = avaliar(caso.expression)
        if (caso.expectThrows) falhas.push(`${caso.name}: esperava erro, devolveu ${JSON.stringify(recebido)}`)
        else if (!iguais(recebido, caso.expected))
          falhas.push(`${caso.name}: esperado ${JSON.stringify(caso.expected)}, recebido ${JSON.stringify(recebido)}`)
      } catch (erro) {
        if (!caso.expectThrows) falhas.push(`${caso.name}: lançou ${(erro as Error).message}`)
      }
    }
    return falhas
  }

  const executaveis = ['javascript', 'typescript']

  const exercicios = conteudo.modules.flatMap((modulo) =>
    modulo.items.flatMap((item) => {
      const exercicio = item.type === 'lesson' ? item.exercise : undefined
      if (!exercicio || exercicio.kind !== 'code') return []
      if (!executaveis.includes(exercicio.language)) return []
      if (!exercicio.solution || exercicio.tests.length === 0) return []
      return [{ onde: `${modulo.id} / ${exercicio.id}`, exercicio }]
    }),
  )

  const questoes = conteudo.modules.flatMap((modulo) =>
    modulo.assessments.flatMap((avaliacao) =>
      avaliacao.questions.flatMap((questao) => {
        if (questao.kind !== 'pratica') return []
        if (!executaveis.includes(questao.language)) return []
        if (!questao.solution || questao.tests.length === 0) return []
        return [{ onde: `${modulo.id} / ${avaliacao.id} / ${questao.id}`, exercicio: questao }]
      }),
    ),
  )

  // Desafio tem solucao e testes como os outros dois, e nao era verificado:
  // uma solucao oficial quebrada ali so apareceria para quem estuda.
  const desafios = conteudo.challenges.flatMap((desafio) => {
    if (!executaveis.includes(desafio.language)) return []
    if (!desafio.solution || desafio.tests.length === 0) return []
    return [{ onde: `desafio / ${desafio.id}`, exercicio: desafio }]
  })

  it('há exercícios executáveis para verificar', () => {
    // Guarda contra o teste virar vazio em silêncio depois de um refactor.
    expect(exercicios.length).toBeGreaterThan(20)
    expect(desafios.length).toBeGreaterThan(10)
  })

  it.each([...exercicios, ...questoes, ...desafios])('$onde', ({ exercicio }) => {
    const falhas = rodar(exercicio.solution!, exercicio.language, exercicio.tests)
    expect(falhas).toEqual([])
  })
})

describe('revisão aponta para prática', () => {
  /**
   * A revisao oferece um desafio quando ele exercita o topico que a avaliacao
   * apontou. Sem esta guarda, renomear topicos de um lado esvaziaria a ligacao
   * em silencio e a revisao voltaria a ser releitura.
   */
  const topicosDeAvaliacao = new Set(
    conteudo.modules.flatMap((modulo) =>
      modulo.assessments.flatMap((avaliacao) => avaliacao.questions.flatMap((questao) => questao.topics)),
    ),
  )
  const topicosDeDesafio = new Set(conteudo.challenges.flatMap((desafio) => desafio.topics))

  it('todo desafio declara pelo menos um tópico', () => {
    const semTopico = conteudo.challenges.filter((desafio) => desafio.topics.length === 0)
    expect(semTopico.map((d) => d.id)).toEqual([])
  })

  it('os tópicos dos desafios existem no vocabulário das avaliações', () => {
    const orfaos = [...topicosDeDesafio].filter((topico) => !topicosDeAvaliacao.has(topico))
    expect(orfaos).toEqual([])
  })

  it('uma parte relevante dos tópicos de avaliação tem desafio', () => {
    const cobertos = [...topicosDeAvaliacao].filter((topico) => topicosDeDesafio.has(topico))
    expect(cobertos.length).toBeGreaterThan(15)
  })
})
