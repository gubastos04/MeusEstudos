import type { TestCase } from '../content/schema'
import { PYTHON_WORKER_SOURCE } from './python-worker-source'
import type { CaseResult, RunOutcome } from './types'

/**
 * Execucao de Python no navegador via Pyodide.
 *
 * Opt-in de proposito: o runtime tem alguns megabytes. A interface pergunta
 * antes de baixar, porque a pessoa pode estar no celular em rede movel.
 * Se o download falhar, o exercicio continua utilizavel com verificacao
 * estrutural e a mensagem diz exatamente o que aconteceu.
 */

const DEFAULT_INDEX_URL =
  process.env.NEXT_PUBLIC_PYODIDE_URL ?? 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'

// Primeira execucao inclui o download do runtime.
const FIRST_RUN_TIMEOUT_MS = 90_000
const RUN_TIMEOUT_MS = 10_000

type Pending = {
  resolve: (value: WorkerReply) => void
  timer: ReturnType<typeof setTimeout>
}

type WorkerReply =
  | { ok: true; payload: PythonPayload }
  | { ok: false; message: string }

type PythonPayload = {
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

export function isPythonRuntimeLoaded(): boolean {
  return runtimeLoaded
}

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  if (!blobUrl) {
    blobUrl = URL.createObjectURL(new Blob([PYTHON_WORKER_SOURCE], { type: 'application/javascript' }))
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
      entry.resolve({ ok: false, message: 'O ambiente Python parou de responder.' })
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

export async function runPython(code: string, tests: TestCase[]): Promise<RunOutcome> {
  const started = Date.now()
  const instance = ensureWorker()

  if (!instance) {
    return failure('Este navegador não suporta a execução de Python aqui.', tests.length, started)
  }

  const id = nextId++
  const timeoutMs = runtimeLoaded ? RUN_TIMEOUT_MS : FIRST_RUN_TIMEOUT_MS

  const reply = await new Promise<WorkerReply>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      // Encerrar o Worker e a unica forma confiavel de parar um laco infinito.
      resetWorker()
      resolve({
        ok: false,
        message: runtimeLoaded
          ? `A execução passou de ${RUN_TIMEOUT_MS / 1000}s e foi interrompida. Geralmente é um laço que não termina.`
          : 'O download do Python demorou demais. Verifique a conexão e tente de novo.',
      })
    }, timeoutMs)

    pending.set(id, { resolve, timer })

    instance.postMessage({
      id,
      indexUrl: DEFAULT_INDEX_URL,
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
