import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * O healthcheck so vale pelo caminho de falha: uma rota que devolve `ok` com o
 * banco fora e pior que nenhuma rota. Entao o teste que importa aqui e o de
 * 503, nao o de 200.
 */

const { db } = await import('@/lib/db')
const { GET: rotaSaude } = await import('@/app/api/saude/route')

const chamar = () =>
  rotaSaude(new Request('http://localhost/api/saude'), { params: Promise.resolve({}) })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('healthcheck', () => {
  it('responde ok quando o banco atende, sem exigir sessao', async () => {
    const resposta = await chamar()
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ ok: true })
  })

  // Trava a decisao de nao expor contagem de conteudo num endpoint publico:
  // acrescentar campo aqui passa a quebrar o teste em vez de passar em review.
  it('nao devolve nada alem de ok', async () => {
    const corpo = (await (await chamar()).json()) as Record<string, unknown>
    expect(Object.keys(corpo)).toEqual(['ok'])
  })

  it('responde 503 quando a consulta ao banco falha', async () => {
    vi.spyOn(db, '$queryRaw').mockRejectedValue(new Error('P1000: authentication failed'))
    const erroLogado = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const resposta = await chamar()

    expect(resposta.status).toBe(503)
    expect(await resposta.json()).toMatchObject({ ok: false })

    // Verificar o log e verificar interacao, e aqui e o caso em que isso e
    // certo: o log sai do sistema e e metade do motivo da rota existir. Sem
    // ele, producao quebrada chega como digest opaco.
    expect(erroLogado).toHaveBeenCalled()
  })

  it('nao deixa a mensagem de erro do banco vazar para quem chamou', async () => {
    vi.spyOn(db, '$queryRaw').mockRejectedValue(new Error('P1000: authentication failed for user'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const corpo = JSON.stringify(await (await chamar()).json())

    expect(corpo).not.toContain('P1000')
    expect(corpo).not.toContain('authentication')
  })
})
