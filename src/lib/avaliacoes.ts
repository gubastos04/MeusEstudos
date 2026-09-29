import type { Assessment, Question } from './content/schema'

/**
 * Avaliacoes.
 *
 * Regra central: a chave de resposta NUNCA chega ao navegador antes de a pessoa
 * responder. A pagina recebe apenas a versao sem gabarito, e a correcao das
 * questoes de alternativa acontece no servidor.
 *
 * Nas questoes praticas, os testes rodam no navegador (nao existe execucao de
 * codigo de usuario no servidor). O que o servidor guarda e o resultado
 * informado, e as verificacoes estruturais sao reexecutadas aqui, porque sao
 * deterministicas. A interface diz isso com clareza.
 */

export type QuestaoPublica = {
  id: string
  kind: Question['kind']
  prompt: string
  code?: { language: string; code: string }
  /** Apenas em questoes de alternativa. */
  choices?: string[]
  /** Apenas em questoes praticas. */
  language?: string
  starter?: string
  /** Testes visiveis. Casos marcados como ocultos nao vao para o cliente. */
  tests?: { name: string; expression: string; expected: unknown; expectThrows: boolean }[]
  checks?: { name: string; type: string; value: string; hint?: string; caseSensitive: boolean }[]
  hints?: string[]
  criteria?: string[]
  topics: string[]
}

export function questaoPublica(questao: Question): QuestaoPublica {
  if (questao.kind === 'pratica') {
    return {
      id: questao.id,
      kind: questao.kind,
      prompt: questao.prompt,
      code: questao.code,
      language: questao.language,
      starter: questao.starter,
      // Casos ocultos existem para nao permitir ajustar o codigo ao teste.
      tests: questao.tests
        .filter((teste) => !teste.hidden)
        .map((teste) => ({
          name: teste.name,
          expression: teste.expression,
          expected: teste.expected,
          expectThrows: teste.expectThrows,
        })),
      checks: questao.checks.map((verificacao) => ({
        name: verificacao.name,
        type: verificacao.type,
        value: verificacao.value,
        hint: verificacao.hint,
        caseSensitive: verificacao.caseSensitive,
      })),
      hints: questao.hints,
      criteria: questao.criteria,
      topics: questao.topics,
    }
  }

  // Alternativa: sem answerIndex, sem explanation, sem wrongExplanations.
  return {
    id: questao.id,
    kind: questao.kind,
    prompt: questao.prompt,
    code: questao.code,
    choices: questao.choices,
    topics: questao.topics,
  }
}

export function avaliacaoPublica(avaliacao: Assessment) {
  return {
    id: avaliacao.id,
    title: avaliacao.title,
    format: avaliacao.format,
    summary: avaliacao.summary,
    estimatedMinutes: avaliacao.estimatedMinutes,
    topics: avaliacao.topics,
    questions: avaliacao.questions.map(questaoPublica),
  }
}

/**
 * Resultado de uma tentativa, em linguagem informativa.
 *
 * Nao existe aprovado/reprovado, nota publica nem comparacao com outras pessoas.
 * O texto diz o que foi demonstrado e o que vale revisar.
 */
export type ResumoTentativa = {
  total: number
  corretas: number
  topicosDemonstrados: string[]
  topicosParaRevisar: string[]
}

export function resumirTentativa(
  avaliacao: Assessment,
  respostas: { questionId: string; correct: boolean }[],
): ResumoTentativa {
  const porQuestao = new Map(respostas.map((resposta) => [resposta.questionId, resposta.correct]))

  // Um topico so entra em "revisar" quando a pessoa errou alguma questao dele.
  // Topico com acerto em todas as questoes entra em "demonstrados".
  const acertos = new Map<string, { certas: number; total: number }>()

  for (const questao of avaliacao.questions) {
    const correta = porQuestao.get(questao.id)
    if (correta === undefined) continue

    for (const topico of questao.topics) {
      const atual = acertos.get(topico) ?? { certas: 0, total: 0 }
      atual.total += 1
      if (correta) atual.certas += 1
      acertos.set(topico, atual)
    }
  }

  const demonstrados: string[] = []
  const revisar: string[] = []

  for (const [topico, contagem] of acertos) {
    if (contagem.certas === contagem.total) demonstrados.push(topico)
    else revisar.push(topico)
  }

  return {
    total: respostas.length,
    corretas: respostas.filter((resposta) => resposta.correct).length,
    topicosDemonstrados: demonstrados.sort(),
    topicosParaRevisar: revisar.sort(),
  }
}
