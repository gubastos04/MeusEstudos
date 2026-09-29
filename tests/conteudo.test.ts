import { describe, expect, it } from 'vitest'

import { reloadContent } from '@/lib/content/loader'

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
