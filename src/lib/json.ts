/**
 * Serializacao para os campos String que guardam JSON no banco.
 * O schema Prisma nao usa o tipo Json para manter SQLite e PostgreSQL
 * compativeis com o mesmo arquivo.
 *
 * Nada aqui lanca excecao: dado invalido no banco nao pode derrubar uma tela.
 */

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw)
    return (value ?? fallback) as T
  } catch {
    return fallback
  }
}

export function parseStringArray(raw: string | null | undefined): string[] {
  const value = parseJson<unknown>(raw, [])
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function parseBooleanArray(raw: string | null | undefined): boolean[] {
  const value = parseJson<unknown>(raw, [])
  if (!Array.isArray(value)) return []
  return value.map((item) => item === true)
}

export function parseRecord(raw: string | null | undefined): Record<string, boolean> {
  const value = parseJson<unknown>(raw, {})
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = item === true
  }
  return out
}

export function toJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return 'null'
  }
}
