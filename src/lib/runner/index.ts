import type { StructuralCheck, TestCase } from '../content/schema'
import { runStructuralChecks } from './structural'
import { runJavaScript } from './run-js'
import { runPython } from './run-python'
import { runSql } from './run-sql'
import type { CaseResult, RunOutcome } from './types'

export { runStructuralChecks } from './structural'
export { isPythonRuntimeLoaded } from './run-python'
export { isSqlRuntimeLoaded } from './run-sql'
export type { CaseResult, RunOutcome } from './types'

/**
 * Escolhe como verificar o codigo.
 *
 * - JavaScript/TypeScript: execucao real em Worker, sempre disponivel;
 * - SQL: execucao real via sql.js, tambem sem perguntar. O wasm do SQLite sao
 *   ~330 kB pela rede, menos que uma foto: pedir autorizacao para isso seria
 *   cerimonia sem beneficio;
 * - Python: execucao real via Pyodide, sob confirmacao, porque ali sao mesmo
 *   alguns megabytes e a pessoa pode estar em rede movel;
 * - demais linguagens: verificacao estrutural.
 *
 * `checks` sempre roda quando existir, inclusive junto com os testes: serve
 * para exigir coisas que o resultado nao mostra (ex.: "usou parâmetro nomeado").
 */

export type RunnerCapability = 'execucao' | 'execucao-sob-demanda' | 'estrutura'

/**
 * Runtimes grandes o bastante para a interface perguntar antes de baixar.
 * SQL fica fora de proposito: sao ~330 kB, carregados no primeiro Executar.
 */
const RUNTIMES_SOB_DEMANDA: Record<string, { nome: string; tamanho: string }> = {
  python: { nome: 'Python', tamanho: 'alguns megabytes' },
}

/** Nome e tamanho do runtime a baixar, para a interface pedir autorizacao. */
export function runtimeSobDemanda(language: string): { nome: string; tamanho: string } | null {
  return RUNTIMES_SOB_DEMANDA[language] ?? null
}

export function capabilityFor(language: string, tests: TestCase[]): RunnerCapability {
  if (tests.length === 0) return 'estrutura'
  if (language === 'javascript' || language === 'typescript' || language === 'sql') return 'execucao'
  if (RUNTIMES_SOB_DEMANDA[language]) return 'execucao-sob-demanda'
  return 'estrutura'
}

export async function runExercise(params: {
  code: string
  language: string
  tests: TestCase[]
  checks: StructuralCheck[]
  /** Autorizacao explicita para baixar o runtime de Python. */
  allowHeavyRuntime?: boolean
}): Promise<RunOutcome> {
  const { code, language, tests, checks, allowHeavyRuntime = false } = params
  const structural = checks.length > 0 ? runStructuralChecks(code, checks) : []

  if (tests.length === 0) {
    return combine([], structural, [], 0)
  }

  const capability = capabilityFor(language, tests)

  if (capability === 'execucao') {
    const outcome = language === 'sql' ? await runSql(code, tests) : await runJavaScript(code, tests, language)
    return combine(outcome.cases, structural, outcome.output, outcome.durationMs, outcome.error)
  }

  if (capability === 'execucao-sob-demanda') {
    const runtime = runtimeSobDemanda(language)

    if (!allowHeavyRuntime) {
      return {
        ...combine([], structural, [], 0),
        error: `Para rodar os testes é preciso baixar o ${runtime?.nome ?? 'runtime'} uma vez.`,
      }
    }

    const outcome = await runPython(code, tests)
    return combine(outcome.cases, structural, outcome.output, outcome.durationMs, outcome.error)
  }

  // Linguagem sem runtime: sobra a verificacao estrutural, e a interface avisa.
  return combine([], structural, [], 0)
}

function combine(
  executed: CaseResult[],
  structural: CaseResult[],
  output: string[],
  durationMs: number,
  error?: string,
): RunOutcome {
  const cases = [...executed, ...structural]
  const passedCount = cases.filter((item) => item.passed).length

  return {
    passed: cases.length > 0 && passedCount === cases.length && !error,
    cases,
    passedCount,
    totalCount: cases.length,
    output,
    error,
    durationMs,
  }
}
