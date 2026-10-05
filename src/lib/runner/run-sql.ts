import type { TestCase } from '../content/schema'
import { SQL_WORKER_SOURCE } from './sql-worker-source'
import type { CaseResult, RunOutcome } from './types'

/**
 * Execucao de SQL no navegador via sql.js (SQLite em WebAssembly).
 *
 * Existe porque `banco-dados` tinha o melhor conteudo do acervo e nenhuma
 * execucao: cinco aulas sobre SELECT, JOIN, indice e transacao, verificadas
 * por casamento de padrao de texto. SQL e a habilidade mais duravel que a
 * plataforma ensina, e era a unica que ela ensinava sem deixar praticar.
 *
 * Opt-in como o Python: o wasm do SQLite tem mais de um megabyte, e a pessoa
 * pode estar em rede movel. Se o download falhar, o exercicio continua
 * utilizavel com verificacao estrutural e a mensagem diz o que aconteceu.
 *
 * A plumbing de Worker repete a de `run-python.ts` de proposito. Extrair um
 * pool compartilhado mexeria no caminho do Python, que nenhum teste cobre
 * (Worker nao existe no node), e o ganho seria de linhas, nao de clareza.
 */

// ~330 kB pela rede (17 kB de JS + 315 kB de wasm comprimido).
const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_SQLJS_URL ?? 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/'

// Primeira execucao inclui o download do wasm.
const FIRST_RUN_TIMEOUT_MS = 60_000
const RUN_TIMEOUT_MS = 10_000

type Pending = {
  resolve: (value: WorkerReply) => void
  timer: ReturnType<typeof setTimeout>
}

type WorkerReply = { ok: true; payload: SqlPayload } | { ok: false; message: string }

type SqlPayload = {
  erroCarregamento: string | null
  resultados: {
    name: string
    passed: boolean
    expected: string | null
    received: string | null
    message: string | null
    hidden: boolean
  }[]
  saida: string
}

let worker: Worker | null = null
let blobUrl: string | null = null
let runtimeLoaded = false
let nextId = 1
const pending = new Map<number, Pending>()

export function isSqlRuntimeLoaded(): boolean {
  return runtimeLoaded
}

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  if (!blobUrl) {
    blobUrl = URL.createObjectURL(new Blob([SQL_WORKER_SOURCE], { type: 'application/javascript' }))
  }

  try {
    worker = new Worker(blobUrl)
  } catch {
    return null
  }

  worker.onmessage = (event: MessageEvent<{ id: number } & WorkerReply>) => {
    const entry = pending.get(event.data.id)
    if (!entry) return
    clearTimeout(entry.timer)
    pending.delete(event.data.id)
    const { id: _id, ...reply } = event.data
    entry.resolve(reply as WorkerReply)
  }

  worker.onerror = () => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.resolve({ ok: false, message: 'O ambiente SQLite parou de responder.' })
    }
    pending.clear()
    resetWorker()
  }

  return worker
}

function resetWorker() {
  worker?.terminate()
  worker = null
  runtimeLoaded = false
}

export async function runSql(code: string, tests: TestCase[]): Promise<RunOutcome> {
  const started = Date.now()
  const instance = ensureWorker()

  if (!instance) {
    return failure('Este navegador não suporta a execução de SQL aqui.', tests.length, started)
  }

  const id = nextId++
  const timeoutMs = runtimeLoaded ? RUN_TIMEOUT_MS : FIRST_RUN_TIMEOUT_MS

  const reply = await new Promise<WorkerReply>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      // Encerrar o Worker e a unica forma confiavel de parar uma consulta que
      // nao termina (junção sem condicao sobre tabela grande, por exemplo).
      resetWorker()
      resolve({
        ok: false,
        message: runtimeLoaded
          ? `A execução passou de ${RUN_TIMEOUT_MS / 1000}s e foi interrompida. Geralmente é uma junção sem condição.`
          : 'O download do SQLite demorou demais. Verifique a conexão e tente de novo.',
      })
    }, timeoutMs)

    pending.set(id, { resolve, timer })

    instance.postMessage({
      id,
      baseUrl: DEFAULT_BASE_URL,
      code,
      cases: tests.map((test) => ({
        name: test.name,
        expression: test.expression,
        expected: test.expected,
        expectThrows: test.expectThrows,
        hidden: test.hidden,
      })),
    })
  })

  const durationMs = Date.now() - started

  if (!reply.ok) {
    return failure(reply.message, tests.length, started)
  }

  runtimeLoaded = true

  const payload = reply.payload
  const output = payload.saida ? payload.saida.split('\n').filter((line) => line.length > 0) : []

  if (payload.erroCarregamento) {
    return {
      passed: false,
      cases: [],
      passedCount: 0,
      totalCount: tests.length,
      output,
      error: payload.erroCarregamento,
      durationMs,
    }
  }

  const cases: CaseResult[] = payload.resultados.map((result) => ({
    name: result.name,
    passed: result.passed,
    mode: 'execucao',
    expected: result.expected ?? undefined,
    received: result.received ?? undefined,
    message: result.message ?? undefined,
    hidden: result.hidden,
  }))

  const passedCount = cases.filter((item) => item.passed).length

  return {
    passed: cases.length > 0 && passedCount === cases.length,
    cases,
    passedCount,
    totalCount: cases.length,
    output,
    durationMs,
  }
}

function failure(message: string, totalCount: number, started: number): RunOutcome {
  return {
    passed: false,
    cases: [],
    passedCount: 0,
    totalCount,
    output: [],
    error: message,
    durationMs: Date.now() - started,
  }
}
