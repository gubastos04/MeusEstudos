import type { ContentLanguage, StructuralCheck, TestCase } from '../content/schema'

/**
 * Resultado de uma verificacao de codigo.
 *
 * O produto distingue dois niveis, e a interface diz qual foi usado:
 * - `tests`: o codigo foi EXECUTADO e comparado com o esperado;
 * - `checks`: o codigo foi LIDO por padroes (nao prova que funciona).
 */

export type CaseResult = {
  name: string
  passed: boolean
  /** Como o caso foi verificado. */
  mode: 'execucao' | 'estrutura'
  expected?: string
  received?: string
  /** Mensagem tecnica (erro lancado, padrao nao encontrado). */
  message?: string
  hidden?: boolean
}

export type RunOutcome = {
  /** false apenas quando algum caso falhou; erro de infraestrutura vira `error`. */
  passed: boolean
  cases: CaseResult[]
  passedCount: number
  totalCount: number
  /** Saida de console produzida pelo codigo. */
  output: string[]
  /** Falha do proprio runner (timeout, runtime indisponivel), nao do exercicio. */
  error?: string
  durationMs: number
}

export type RunRequest = {
  code: string
  language: ContentLanguage
  tests: TestCase[]
  checks: StructuralCheck[]
}

export const EMPTY_OUTCOME: RunOutcome = {
  passed: false,
  cases: [],
  passedCount: 0,
  totalCount: 0,
  output: [],
  durationMs: 0,
}
