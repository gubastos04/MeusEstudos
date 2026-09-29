'use client'

/**
 * Chamadas a API a partir do navegador.
 *
 * Um unico lugar trata: corpo JSON, erro de rede, resposta que nao e JSON e o
 * formato de erro do servidor ({ ok: false, erro, campo }).
 * As telas recebem sempre o mesmo formato e nunca precisam de try/catch proprio.
 */

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campo?: string; status: number }

async function requisitar<T>(url: string, init: RequestInit): Promise<Resultado<T>> {
  let resposta: Response

  try {
    resposta = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    })
  } catch {
    return {
      ok: false,
      erro: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
      status: 0,
    }
  }

  let corpo: unknown = null
  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }

  const dados = (corpo ?? {}) as Record<string, unknown>

  if (!resposta.ok || dados.ok === false) {
    return {
      ok: false,
      erro:
        typeof dados.erro === 'string'
          ? dados.erro
          : 'Não foi possível concluir. Tente novamente.',
      campo: typeof dados.campo === 'string' ? dados.campo : undefined,
      status: resposta.status,
    }
  }

  return { ok: true, dados: dados as T }
}

export function enviar<T = Record<string, unknown>>(url: string, corpo: unknown): Promise<Resultado<T>> {
  return requisitar<T>(url, { method: 'POST', body: JSON.stringify(corpo) })
}

export function atualizar<T = Record<string, unknown>>(url: string, corpo: unknown): Promise<Resultado<T>> {
  return requisitar<T>(url, { method: 'PATCH', body: JSON.stringify(corpo) })
}

export function remover<T = Record<string, unknown>>(url: string): Promise<Resultado<T>> {
  return requisitar<T>(url, { method: 'DELETE' })
}

export function buscar<T = Record<string, unknown>>(url: string): Promise<Resultado<T>> {
  return requisitar<T>(url, { method: 'GET' })
}

/**
 * Envio que nao pode falhar em silencio nem atrapalhar a navegacao.
 * Usado para salvar progresso ao sair da tela.
 */
export function enviarEmSegundoPlano(url: string, corpo: unknown): void {
  const dados = JSON.stringify(corpo)

  // sendBeacon sobrevive ao fechamento da aba, que e exatamente o caso aqui.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const enviado = navigator.sendBeacon(url, new Blob([dados], { type: 'application/json' }))
    if (enviado) return
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: dados,
    keepalive: true,
  }).catch(() => undefined)
}
