import type { TestCase } from '../content/schema'
import { JS_WORKER_SOURCE } from './js-worker-source'
import type { CaseResult, RunOutcome } from './types'

/**
 * Executa exercicios de JavaScript/TypeScript no navegador, dentro de um Worker.
 *
 * TypeScript: o codigo e executado como JavaScript. Anotacoes de tipo simples
 * sao removidas antes (ver stripTypes). Nao ha compilador embarcado — isto vale
 * para exercicios pequenos, que e o caso aqui.
 */

const TIMEOUT_MS = 3000

let cachedBlobUrl: string | null = null

function workerUrl(): string {
  if (!cachedBlobUrl) {
    const blob = new Blob([JS_WORKER_SOURCE], { type: 'application/javascript' })
    cachedBlobUrl = URL.createObjectURL(blob)
  }
  return cachedBlobUrl
}

type WorkerReply =
  | { ok: true; results: RawResult[]; output: string[] }
  | { ok: false; stage: string; message: string; output: string[] }

type RawResult = {
  name: string
  passed: boolean
  expected?: string
  received?: string
  message?: string
  hidden?: boolean
}

export async function runJavaScript(code: string, tests: TestCase[], language = 'javascript'): Promise<RunOutcome> {
  const started = Date.now()
  const source = language === 'typescript' ? stripTypes(code) : code

  if (typeof Worker === 'undefined') {
    return {
      passed: false,
      cases: [],
      passedCount: 0,
      totalCount: tests.length,
      output: [],
      error: 'Este navegador não suporta a execução de código aqui.',
      durationMs: 0,
    }
  }

  let worker: Worker
  try {
    worker = new Worker(workerUrl())
  } catch {
    return {
      passed: false,
      cases: [],
      passedCount: 0,
      totalCount: tests.length,
      output: [],
      error: 'Não foi possível iniciar o ambiente de execução.',
      durationMs: Date.now() - started,
    }
  }

  const reply = await new Promise<WorkerReply | 'timeout'>((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      clearTimeout(timer)
      resolve(event.data)
    }
    worker.onerror = (event) => {
      clearTimeout(timer)
      resolve({
        ok: false,
        stage: 'execucao',
        message: event.message || 'Erro ao executar o código.',
        output: [],
      })
    }

    worker.postMessage({
      code: source,
      cases: tests.map((test) => ({
        name: test.name,
        expression: test.expression,
        expected: test.expected,
        expectThrows: test.expectThrows,
        hidden: test.hidden,
      })),
    })
  })

  worker.terminate()
  const durationMs = Date.now() - started

  if (reply === 'timeout') {
    return {
      passed: false,
      cases: [],
      passedCount: 0,
      totalCount: tests.length,
      output: [],
      // Mensagem tecnica: e um problema real do codigo, e o texto ajuda a achar a causa.
      error: `A execução passou de ${TIMEOUT_MS / 1000}s e foi interrompida. Geralmente é um laço que não termina.`,
      durationMs,
    }
  }

  if (!reply.ok) {
    return {
      passed: false,
      cases: [],
      passedCount: 0,
      totalCount: tests.length,
      output: reply.output ?? [],
      error: explicarFalha(reply.message, language),
      durationMs,
    }
  }

  const cases: CaseResult[] = reply.results.map((result) => ({
    name: result.name,
    passed: result.passed,
    mode: 'execucao',
    expected: result.expected,
    received: result.received,
    message: result.message,
    hidden: result.hidden,
  }))

  const passedCount = cases.filter((item) => item.passed).length

  return {
    passed: cases.length > 0 && passedCount === cases.length,
    cases,
    passedCount,
    totalCount: cases.length,
    output: reply.output ?? [],
    durationMs,
  }
}

/**
 * Acrescenta contexto a falhas que a mensagem do motor nao explica.
 *
 * O caso concreto: em TypeScript, uma declaracao de tipo que a remocao nao
 * alcancou chega ao motor e vira "Unexpected strict mode reserved word" — uma
 * mensagem que nao ajuda ninguem a achar a causa.
 */
function explicarFalha(mensagem: string, language: string): string {
  const pareceTipoNaoRemovido =
    language === 'typescript' &&
    /reserved word|Unexpected token/i.test(mensagem)

  if (!pareceTipoNaoRemovido) return mensagem

  return `${mensagem}\n\nIsto costuma ser uma declaração de tipo que a plataforma não conseguiu remover antes de executar. Declare interfaces de forma simples, sem objetos aninhados dentro.`
}

/**
 * Remove anotacoes de tipo comuns para que exercicios em TypeScript rodem.
 * Cobre o que aparece em exercicio pequeno: `: tipo` em parametros/retorno,
 * `as tipo`, `interface`/`type` e `!` de assercao.
 *
 * Nao e um compilador. O limite conhecido e a declaracao com chaves aninhadas
 * (`interface A { b: { c: number } }`): ela nao e removida por inteiro, e o
 * `interface` que sobra vira SyntaxError. Casos assim devem usar exercicios de
 * JavaScript — ou tipos declarados de forma simples, que e o caso em exercicio
 * pequeno.
 */
const ANOTACAO =
  /:\s*(Promise<[^>]*>|Record<[^>]*>|Array<[^>]*>|[A-Za-z_$][\w$.]*(\[\])?(\s*\|\s*[A-Za-z_$][\w$.]*(\[\])?)*)(?=\s*[=,)\n{;])/g

/**
 * Remove as anotacoes de UMA linha.
 *
 * O cuidado aqui e o ternario: em `condicao ? a : valor`, o `: valor` tem a
 * mesma forma de uma anotacao de tipo e seria apagado, quebrando o codigo.
 * Parametro opcional (`nome?: string`) nao e confundido porque ali o `?` vem
 * colado no `:`.
 */
function removerAnotacoesDaLinha(linha: string): string {
  const inicioDoTernario = linha.search(/\?\s/)

  return linha.replace(ANOTACAO, (encontrado, ...argumentos) => {
    const indice = argumentos[argumentos.length - 2] as number
    const depoisDoTernario = inicioDoTernario !== -1 && indice > inicioDoTernario
    return depoisDoTernario ? encontrado : ''
  })
}

export function stripTypes(code: string): string {
  return (
    code
      // `interface X { ... }`, em uma linha ou em varias. Nao depende de a
      // declaracao comecar a linha: ela pode vir depois de outro codigo.
      .replace(/(export\s+)?\binterface\s+\w+[^{]*\{[^{}]*\}\s*;?/g, '')
      // `type X = ...` ate o fim da linha ou o ponto e virgula. O lookbehind
      // evita apagar `item.type = ...`, que e atribuicao comum de propriedade.
      .replace(/(?<![.\w])(export\s+)?\btype\s+\w+\s*=[^;\n]+;?/g, '')
      // `as Tipo`. O tipo nao pode conter espaco: com `\s` na classe, a
      // expressao engolia o resto do arquivo a partir do `as`.
      .replace(/\bas\s+(const\b|[A-Za-z_$][\w$.]*(\[\])?(<[^>\n]*>)?)/g, '')
      .split('\n')
      .map(removerAnotacoesDaLinha)
      .join('\n')
      // `valor!.campo`, `lista[0]!.campo`, `f()!.campo`.
      .replace(/([\w\])])!(\s*[.[(])/g, '$1$2')
      .replace(/<[A-Z]\w*(,\s*[A-Z]\w*)*>(?=\()/g, '')
  )
}
