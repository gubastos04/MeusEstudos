'use client'

/**
 * Leitura offline.
 *
 * Duas partes:
 *
 * 1. CACHE DE CONTEUDO. O modulo baixado fica no Cache Storage, num cache
 *    proprio. E material de estudo, nunca dado de usuario — nada de progresso,
 *    anotacao ou erro registrado vai para o aparelho desse jeito.
 *
 * 2. FILA DE PROGRESSO. O que a pessoa marca offline entra numa fila local e
 *    sobe quando a conexao volta. O servidor continua sendo a fonte oficial do
 *    progresso: a fila e um adiamento do envio, nao uma segunda verdade.
 *
 * Conflitos (spec 56): resolvidos de forma previsivel e sem apagar nada.
 * - `concluir` e idempotente no servidor e nunca rebaixa status;
 * - a fila guarda UMA entrada por conteudo e acao, somando o tempo — replay
 *   nao conta o mesmo minuto duas vezes;
 * - cada entrada leva `ocorridoEm`, e o servidor so move o ponto de parada
 *   quando o evento e mais recente que o ultimo acesso registrado.
 */

export const CACHE_CONTEUDO = 'meus-estudos-conteudo-v1'
export const CACHE_PAGINAS = 'meus-estudos-paginas-v1'
// Precisa bater com o nome em public/sw.js: o service worker serve
// /_next/static a partir deste cache, e ele nao pode importar deste modulo.
export const CACHE_ESTATICO = 'meus-estudos-estatico-v1'

const CHAVE_FILA = 'meus-estudos:fila-progresso'
const ROTA_OFFLINE = '/leitura-offline'

// --- Conteudo baixado --------------------------------------------------------

export type ItemOffline = {
  id: string
  type: 'lesson' | 'checkpoint'
  title: string
  estimatedMinutes: number
  [chave: string]: unknown
}

export type ModuloOffline = {
  modulo: {
    id: string
    title: string
    summary: string
    outcome: string
    semester: number
    stack: string[]
    totalMinutes: number
    items: ItemOffline[]
  }
  glossario: {
    id: string
    term: string
    short: string
    explanation: string
    example?: { language: string; code: string } | null
    whereItAppears: string[]
  }[]
  baixadoEm: string
}

function urlDoModulo(moduloId: string): string {
  return `/api/conteudo/modulo/${moduloId}`
}

/**
 * Guarda o JavaScript e o CSS que a casca da leitura offline referencia.
 *
 * Guardar so o HTML nao basta, e a falha e silenciosa: a tela abre, mostra
 * "Carregando" e fica nisso para sempre, porque sem o bundle da rota o React
 * nunca hidrata. Os nomes dos arquivos mudam a cada build, entao sao lidos do
 * proprio HTML em vez de escritos aqui.
 */
async function guardarAssetsDaCasca(html: string): Promise<void> {
  const estatico = await caches.open(CACHE_ESTATICO)
  const urls = new Set<string>()

  for (const achado of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
    const url = achado[1]
    if (url) urls.add(url)
  }

  await Promise.all(
    [...urls].map(async (url) => {
      if (await estatico.match(url)) return
      try {
        const resposta = await fetch(url)
        if (resposta.ok) await estatico.put(url, resposta)
      } catch {
        // Um arquivo a menos nao invalida o download do modulo. O que faltar
        // volta a ser buscado na proxima vez que houver rede.
      }
    }),
  )
}

export function cacheDisponivel(): boolean {
  return typeof window !== 'undefined' && 'caches' in window
}

/**
 * Baixa um modulo para leitura offline.
 *
 * Alem do conteudo, garante que a tela de leitura offline esteja em cache —
 * sem ela, o conteudo baixado nao teria como ser aberto sem rede.
 */
export async function baixarModulo(moduloId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!cacheDisponivel()) {
    return { ok: false, erro: 'Este navegador não permite guardar conteúdo para ler offline.' }
  }

  try {
    const resposta = await fetch(urlDoModulo(moduloId))

    if (!resposta.ok) {
      return { ok: false, erro: 'Não foi possível baixar o conteúdo agora. Tente de novo.' }
    }

    const cache = await caches.open(CACHE_CONTEUDO)
    await cache.put(urlDoModulo(moduloId), resposta.clone())

    // A casca da leitura offline precisa estar em cache antes de faltar rede.
    const paginas = await caches.open(CACHE_PAGINAS)
    const casca = await fetch(ROTA_OFFLINE)
    if (casca.ok) {
      const html = await casca.clone().text()
      await paginas.put(ROTA_OFFLINE, casca.clone())
      await guardarAssetsDaCasca(html)
    }

    return { ok: true }
  } catch {
    return { ok: false, erro: 'Sem conexão para baixar agora.' }
  }
}

export async function removerModulo(moduloId: string): Promise<void> {
  if (!cacheDisponivel()) return
  try {
    const cache = await caches.open(CACHE_CONTEUDO)
    await cache.delete(urlDoModulo(moduloId))
  } catch {
    // Sem cache disponível não há o que remover.
  }
}

export async function moduloBaixado(moduloId: string): Promise<boolean> {
  if (!cacheDisponivel()) return false
  try {
    const cache = await caches.open(CACHE_CONTEUDO)
    return Boolean(await cache.match(urlDoModulo(moduloId)))
  } catch {
    return false
  }
}

export async function lerModuloOffline(moduloId: string): Promise<ModuloOffline | null> {
  if (!cacheDisponivel()) return null
  try {
    const cache = await caches.open(CACHE_CONTEUDO)
    const resposta = await cache.match(urlDoModulo(moduloId))
    if (!resposta) return null
    return (await resposta.json()) as ModuloOffline
  } catch {
    return null
  }
}

export async function listarModulosBaixados(): Promise<ModuloOffline[]> {
  if (!cacheDisponivel()) return []

  try {
    const cache = await caches.open(CACHE_CONTEUDO)
    const chaves = await cache.keys()
    const modulos: ModuloOffline[] = []

    for (const chave of chaves) {
      const resposta = await cache.match(chave)
      if (!resposta) continue
      try {
        modulos.push((await resposta.json()) as ModuloOffline)
      } catch {
        // Entrada corrompida: ignorada em vez de derrubar a lista inteira.
      }
    }

    return modulos.sort((a, b) => a.modulo.title.localeCompare(b.modulo.title, 'pt-BR'))
  } catch {
    return []
  }
}

// --- Fila de progresso -------------------------------------------------------

export type EventoProgresso = {
  acao: 'concluir' | 'salvar'
  tipo: 'lesson' | 'checkpoint'
  id: string
  moduloId?: string
  bloco?: number
  segundos: number
  ocorridoEm: string
}

function lerFila(): EventoProgresso[] {
  try {
    const bruto = localStorage.getItem(CHAVE_FILA)
    if (!bruto) return []
    const valor = JSON.parse(bruto)
    return Array.isArray(valor) ? (valor as EventoProgresso[]) : []
  } catch {
    // Armazenamento bloqueado ou dado corrompido: fila vazia, sem quebrar a tela.
    return []
  }
}

function gravarFila(fila: EventoProgresso[]): void {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila))
  } catch {
    // Sem armazenamento não há fila; o envio direto continua tentando.
  }
}

/**
 * Coloca um evento na fila, colapsando com o que ja existe para o mesmo
 * conteudo e acao. Somar o tempo aqui e o que impede contar o mesmo minuto
 * duas vezes quando a fila subir.
 */
export function enfileirar(evento: EventoProgresso): void {
  const fila = lerFila()
  const indice = fila.findIndex((item) => item.acao === evento.acao && item.tipo === evento.tipo && item.id === evento.id)

  if (indice === -1) {
    fila.push(evento)
  } else {
    const anterior = fila[indice]!
    fila[indice] = {
      ...evento,
      segundos: anterior.segundos + evento.segundos,
      // O bloco mais recente vence; o mais antigo já não descreve onde parou.
      bloco: evento.bloco ?? anterior.bloco,
    }
  }

  gravarFila(fila)
}

export function pendentes(): number {
  return lerFila().length
}

/**
 * Sobe a fila. Cada evento sai da fila apenas quando o servidor confirma —
 * falha de rede mantem tudo, e a proxima tentativa reenvia.
 */
export async function sincronizar(): Promise<{ enviados: number; restantes: number }> {
  const fila = lerFila()
  if (fila.length === 0) return { enviados: 0, restantes: 0 }

  const restantes: EventoProgresso[] = []
  let enviados = 0

  for (const evento of fila) {
    try {
      const resposta = await fetch('/api/progresso', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(evento),
      })

      if (resposta.ok) {
        enviados += 1
        continue
      }

      // 4xx significa que este evento nunca vai passar (conteúdo removido,
      // sessão de outra conta). Mantê-lo travaria a fila para sempre.
      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 401) {
        console.warn('[offline] evento descartado pelo servidor', evento.id, resposta.status)
        continue
      }

      restantes.push(evento)
    } catch {
      restantes.push(evento)
    }
  }

  gravarFila(restantes)

  return { enviados, restantes: restantes.length }
}

/** Envia agora; se a rede falhar, guarda para depois. Nunca perde o registro. */
export async function registrarProgresso(evento: EventoProgresso): Promise<'enviado' | 'na-fila'> {
  try {
    const resposta = await fetch('/api/progresso', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(evento),
    })

    if (resposta.ok) return 'enviado'

    // Sessão expirada ou servidor fora: guarda e tenta de novo depois.
    if (resposta.status === 401 || resposta.status >= 500) {
      enfileirar(evento)
      return 'na-fila'
    }

    return 'enviado'
  } catch {
    enfileirar(evento)
    return 'na-fila'
  }
}
