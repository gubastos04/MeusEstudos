import { env } from './env'

/**
 * Datas do produto.
 *
 * O "dia" das metricas usa o fuso configurado em APP_TIMEZONE, nao UTC:
 * quem estuda as 23h de Sao Paulo tem de ver aquilo contado no dia certo.
 */

export function dayKey(date: Date = new Date(), timeZone: string = env().APP_TIMEZONE): string {
  try {
    // en-CA formata como YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Chaves dos ultimos `count` dias, do mais antigo para o mais recente. */
export function lastDayKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(dayKey(new Date(from.getTime() - offset * 24 * 60 * 60 * 1000)))
  }
  return keys
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const value = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const value = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

/**
 * Tempo relativo em linguagem neutra. Nunca cobra ausencia:
 * mostra "ha 12 dias", nunca "voce ficou 12 dias sem estudar".
 */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const value = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return '—'

  const diffMs = Date.now() - value.getTime()
  const minutes = Math.round(diffMs / 60_000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  const days = Math.round(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`

  const months = Math.round(days / 30)
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`

  const years = Math.round(months / 12)
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}

/** "10 min", "1 h 20 min". */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
