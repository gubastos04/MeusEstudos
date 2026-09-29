import type { StructuralCheck, TestCase } from '../content/schema'
import { runStructuralChecks } from './structural'
import { runJavaScript } from './run-js'
import { runPython } from './run-python'
import type { CaseResult, RunOutcome } from './types'

export { runStructuralChecks } from './structural'
export { isPythonRuntimeLoaded } from './run-python'
export type { CaseResult, RunOutcome } from './types'

/**
 * Escolhe como verificar o codigo.
 *
 * - JavaScript/TypeScript: execucao real em Worker, sempre disponivel;
 * - Python: execucao real via Pyodide, sob confirmacao (runtime pesado);
 * - demais linguagens: verificacao estrutural.
 *
 * `checks` sempre roda quando existir, inclusive junto com os testes: serve
 * para exigir coisas que o resultado nao mostra (ex.: "usou parâmetro nomeado").
 */

export type RunnerCapability = 'execucao' | 'execucao-sob-demanda' | 'estrutura'

export function capabilityFor(language: string, tests: TestCase[]): RunnerCapability {
  if (tests.length === 0) return 'estrutura'
  if (language === 'javascript' || language === 'typescript') return 'execucao'
  if (language === 'python') return 'execucao-sob-demanda'
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
    const outcome = await runJavaScript(code, tests, language)
    return combine(outcome.cases, structural, outcome.output, outcome.durationMs, outcome.error)
  }

  if (capability === 'execucao-sob-demanda') {
    if (!allowHeavyRuntime) {
      return {
        ...combine([], structural, [], 0),
        error: 'Para rodar os testes em Python é preciso baixar o runtime uma vez.',
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
