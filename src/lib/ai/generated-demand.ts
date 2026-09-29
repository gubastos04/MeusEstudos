import { randomBytes } from 'node:crypto'

import { demandSchema, type Demand } from '../content/schema'
import type { AiRequestInput } from './features'

/**
 * Validacao de demanda gerada por IA (spec 61: nao confiar cegamente).
 *
 * O texto do modelo passa por:
 * 1. extracao do JSON (o modelo pode devolver cercas de codigo apesar da instrucao);
 * 2. normalizacao de campos (id gerado aqui, nunca pelo modelo);
 * 3. validacao pelo MESMO schema das demandas do curriculo.
 *
 * Demanda que nao passa e descartada. A interface sempre marca as que passaram
 * como geradas automaticamente.
 */

export type ValidationResult =
  | { ok: true; demand: Demand }
  | { ok: false; reason: string }

export function validateGeneratedDemand(text: string, request: AiRequestInput): ValidationResult {
  const raw = extractJson(text)
  if (!raw) return { ok: false, reason: 'resposta não era JSON' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'JSON inválido' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'JSON não é um objeto' }
  }

  const candidate = parsed as Record<string, unknown>
  const title = typeof candidate.title === 'string' ? candidate.title : ''

  const normalized = {
    ...candidate,
    // O id vem sempre da plataforma: o modelo nao escolhe identificador.
    id: generatedId(title),
    generated: true,
    // Modulos sao vinculados pelo contexto de estudo, nao pelo modelo, para
    // nao criar referencia a um modulo que nao existe.
    moduleIds: request.context.moduleId ? [request.context.moduleId] : [],
  }

  const result = demandSchema.safeParse(normalized)
  if (!result.success) {
    const first = result.error.issues[0]
    return {
      ok: false,
      reason: first ? `${first.path.join('.') || 'raiz'}: ${first.message}` : 'formato inesperado',
    }
  }

  return { ok: true, demand: result.data }
}

function extractJson(text: string): string | null {
  const trimmed = text.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)

  return null
}

export function generatedId(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  const suffix = randomBytes(3).toString('hex')
  return `ia-${slug || 'demanda'}-${suffix}`
}
