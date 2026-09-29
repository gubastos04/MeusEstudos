// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CACHE_CONTEUDO, CACHE_ESTATICO, CACHE_PAGINAS, baixarModulo } from '@/lib/offline'

/**
 * Baixar um modulo precisa deixar a leitura offline REALMENTE utilizavel.
 *
 * O defeito que estes testes travam foi encontrado testando no navegador:
 * guardavamos o HTML da tela /leitura-offline mas nao o JavaScript dela. A
 * tela abria, mostrava "Carregando" e ficava nisso para sempre, porque sem o
 * bundle da rota o React nunca hidrata. Falha silenciosa, e justamente no
 * unico cenario para o qual a funcionalidade existe.
 */

const CHUNK = '/_next/static/chunks/app/leitura-offline/page-abc123.js'
const CSS = '/_next/static/css/estilo.css'

const CASCA = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="${CSS}"/>
</head><body><div>Carregando</div>
<script src="${CHUNK}"></script>
</body></html>`

/** Cache Storage de mentira: um Map por cache, chaveado pela URL. */
function fabricarCaches() {
  const guardados = new Map<string, Map<string, Response>>()

  const abrir = async (nome: string) => {
    if (!guardados.has(nome)) guardados.set(nome, new Map())
    const alvo = guardados.get(nome)!
    return {
      put: async (chave: string | Request, valor: Response) => {
        alvo.set(typeof chave === 'string' ? chave : chave.url, valor)
      },
      match: async (chave: string | Request) => alvo.get(typeof chave === 'string' ? chave : chave.url),
      keys: async () => [...alvo.keys()].map((url) => ({ url })),
      delete: async (chave: string) => alvo.delete(chave),
    }
  }

  return { caches: { open: abrir }, guardados }
}

function respostaOk(corpo: string, tipo: string) {
  return new Response(corpo, { status: 200, headers: { 'content-type': tipo } })
}

describe('baixar módulo para leitura offline', () => {
  let guardados: Map<string, Map<string, Response>>

  beforeEach(() => {
    const falso = fabricarCaches()
    guardados = falso.guardados
    Object.defineProperty(window, 'caches', { value: falso.caches, configurable: true })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string) => {
        if (entrada.startsWith('/api/conteudo/modulo/')) {
          return respostaOk(JSON.stringify({ modulo: { id: 'x', items: [] } }), 'application/json')
        }
        if (entrada === '/leitura-offline') return respostaOk(CASCA, 'text/html')
        if (entrada.startsWith('/_next/static/')) return respostaOk('/* asset */', 'text/javascript')
        return new Response('nao encontrado', { status: 404 })
      }),
    )
  })

  it('guarda o conteúdo e a casca da tela offline', async () => {
    const resultado = await baixarModulo('pensamento-computacional')

    expect(resultado.ok).toBe(true)
    expect(guardados.get(CACHE_CONTEUDO)?.has('/api/conteudo/modulo/pensamento-computacional')).toBe(true)
    expect(guardados.get(CACHE_PAGINAS)?.has('/leitura-offline')).toBe(true)
  })

  it('guarda o JavaScript da tela offline, sem o qual ela trava em "Carregando"', async () => {
    await baixarModulo('pensamento-computacional')

    expect(guardados.get(CACHE_ESTATICO)?.has(CHUNK)).toBe(true)
  })

  it('guarda também o CSS que a casca referencia', async () => {
    await baixarModulo('pensamento-computacional')

    expect(guardados.get(CACHE_ESTATICO)?.has(CSS)).toBe(true)
  })

  it('um asset que falha não invalida o download do módulo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string) => {
        if (entrada.startsWith('/api/conteudo/modulo/')) {
          return respostaOk(JSON.stringify({ modulo: { id: 'x', items: [] } }), 'application/json')
        }
        if (entrada === '/leitura-offline') return respostaOk(CASCA, 'text/html')
        throw new Error('rede caiu no meio')
      }),
    )

    const resultado = await baixarModulo('pensamento-computacional')

    // O conteudo e a casca ja estao guardados: perder um arquivo estatico nao
    // e motivo para dizer que o download falhou.
    expect(resultado.ok).toBe(true)
    expect(guardados.get(CACHE_CONTEUDO)?.has('/api/conteudo/modulo/pensamento-computacional')).toBe(true)
  })
})
