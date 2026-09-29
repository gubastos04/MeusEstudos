/*
 * Service worker da leitura offline.
 *
 * O que ele guarda:
 * - arquivos estáticos do build (/_next/static), que têm nome versionado;
 * - o conteúdo dos módulos baixados (/api/conteudo/...), que é currículo;
 * - a casca da tela de leitura offline.
 *
 * O que ele NUNCA guarda, e esta é a regra mais importante daqui:
 * - HTML de tela autenticada;
 * - qualquer resposta de API com dado de usuário (progresso, anotações, erros,
 *   demandas, projetos, avaliações, IA, perfil).
 *
 * O motivo é concreto: cache fica no disco do aparelho e sobrevive ao logout.
 * Guardar tela autenticada ali entregaria o conteúdo da conta para quem pegasse
 * o aparelho depois.
 *
 * Quando uma navegação falha por falta de rede, o service worker redireciona
 * para /leitura-offline levando o caminho original. Responder com o HTML de
 * outra página mantendo a URL quebraria o roteador do Next.
 */

const CACHE_ESTATICO = 'meus-estudos-estatico-v1'
const CACHE_CONTEUDO = 'meus-estudos-conteudo-v1'
const CACHE_PAGINAS = 'meus-estudos-paginas-v1'

const ROTA_OFFLINE = '/leitura-offline'

const CACHES_CONHECIDOS = [CACHE_ESTATICO, CACHE_CONTEUDO, CACHE_PAGINAS]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      try {
        const paginas = await caches.open(CACHE_PAGINAS)
        await paginas.add(ROTA_OFFLINE)
      } catch (erro) {
        // A casca também é guardada quando a pessoa baixa um módulo; falhar
        // aqui não pode impedir a instalação do service worker.
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith('meus-estudos-') && !CACHES_CONHECIDOS.includes(nome))
          .map((nome) => caches.delete(nome)),
      )
      await self.clients.claim()
    })(),
  )
})

/** Respostas com dado de usuário não podem entrar em cache. */
function ehDadoDeUsuario(caminho) {
  if (!caminho.startsWith('/api/')) return false
  return !caminho.startsWith('/api/conteudo/')
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request

  if (requisicao.method !== 'GET') return

  const url = new URL(requisicao.url)

  // Só mexe no próprio domínio.
  if (url.origin !== self.location.origin) return

  // Dado de usuário passa direto, sem cache, sempre.
  if (ehDadoDeUsuario(url.pathname)) return

  if (requisicao.mode === 'navigate') {
    evento.respondWith(responderNavegacao(requisicao, url))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    evento.respondWith(cachePrimeiro(requisicao, CACHE_ESTATICO))
    return
  }

  if (url.pathname.startsWith('/api/conteudo/')) {
    evento.respondWith(redeComReservaDeCache(requisicao, CACHE_CONTEUDO))
  }
})

async function responderNavegacao(requisicao, url) {
  try {
    const resposta = await fetch(requisicao)

    // A casca da leitura offline é atualizada sempre que for buscada com rede.
    if (url.pathname === ROTA_OFFLINE && resposta.ok) {
      const cache = await caches.open(CACHE_PAGINAS)
      await cache.put(ROTA_OFFLINE, resposta.clone())
    }

    return resposta
  } catch (erro) {
    const cache = await caches.open(CACHE_PAGINAS)

    if (url.pathname === ROTA_OFFLINE) {
      const guardada = await cache.match(ROTA_OFFLINE)
      if (guardada) return guardada
    }

    const casca = await cache.match(ROTA_OFFLINE)

    if (casca) {
      // Leva o caminho pedido para a tela offline abrir o conteúdo certo.
      const destino = new URL(ROTA_OFFLINE, self.location.origin)
      destino.searchParams.set('caminho', url.pathname)
      return Response.redirect(destino.toString(), 302)
    }

    return new Response(
      'Sem conexão e sem conteúdo baixado neste aparelho.\n\nBaixe um módulo enquanto estiver online para poder ler sem rede.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }
}

async function cachePrimeiro(requisicao, nomeDoCache) {
  const cache = await caches.open(nomeDoCache)
  const guardada = await cache.match(requisicao)
  if (guardada) return guardada

  const resposta = await fetch(requisicao)
  if (resposta.ok) await cache.put(requisicao, resposta.clone())
  return resposta
}

async function redeComReservaDeCache(requisicao, nomeDoCache) {
  const cache = await caches.open(nomeDoCache)

  try {
    const resposta = await fetch(requisicao)
    if (resposta.ok) await cache.put(requisicao, resposta.clone())
    return resposta
  } catch (erro) {
    const guardada = await cache.match(requisicao)
    if (guardada) return guardada
    throw erro
  }
}
