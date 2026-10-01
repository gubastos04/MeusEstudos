import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Transporte de email por HTTP.
 *
 * O que estes testes protegem e uma tensao real: o log precisa dizer QUAL
 * recusa o provedor deu — um 403 pode ser remetente nao verificado ou
 * destinatario fora do modo de teste, e sem isso a investigacao para no painel
 * do provedor —, mas a mensagem de erro do provedor carrega o endereco de quem
 * ia receber, e log de erro e copiado para mais lugares que o resto.
 *
 * Entao: o codigo curto entra, a mensagem nunca.
 */

// Precisa vir antes do import: env() le process.env uma vez e guarda.
process.env.MAIL_TRANSPORTE = 'http'
process.env.MAIL_HTTP_URL = 'https://provedor.test/emails'
process.env.MAIL_HTTP_TOKEN = 'token-de-teste'
process.env.MAIL_FROM = 'remetente@exemplo.test'

const { enviarEmail } = await import('@/lib/email')

const DESTINATARIO = 'pessoa@exemplo.test'

const email = { para: DESTINATARIO, assunto: 'Assunto', texto: 'Corpo' }

let registrado: string[] = []

beforeEach(() => {
  registrado = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    registrado.push(args.map(String).join(' '))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function responderCom(status: number, corpo: unknown, comoTexto = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      comoTexto
        ? new Response(String(corpo), { status })
        : new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }),
    ),
  )
}

describe('recusa do provedor', () => {
  it('registra o status e o código curto do erro', async () => {
    // Formato do Resend ao recusar envio para quem não é dono da conta.
    responderCom(403, {
      statusCode: 403,
      name: 'validation_error',
      message: `You can only send testing emails to your own email address (${DESTINATARIO})`,
    })

    const resultado = await enviarEmail(email)

    expect(resultado.ok).toBe(false)
    expect(registrado.join('\n')).toContain('HTTP 403')
    expect(registrado.join('\n')).toContain('validation_error')
  })

  it('nunca escreve o endereço de quem ia receber', async () => {
    responderCom(403, {
      name: 'validation_error',
      message: `You can only send testing emails to your own email address (${DESTINATARIO})`,
    })

    await enviarEmail(email)

    // É o ponto inteiro: o motivo entra, o dado pessoal não.
    expect(registrado.join('\n')).not.toContain(DESTINATARIO)
    expect(registrado.join('\n')).not.toContain('You can only send')
  })

  it('sem código reconhecível, registra só o status', async () => {
    responderCom(500, { detalhe: 'alguma coisa' })

    await enviarEmail(email)

    expect(registrado.join('\n')).toContain('HTTP 500')
    expect(registrado.join('\n')).not.toContain('/')
  })

  it('corpo que não é JSON não derruba o envio', async () => {
    responderCom(502, '<html>gateway</html>', true)

    const resultado = await enviarEmail(email)

    expect(resultado.ok).toBe(false)
    expect(registrado.join('\n')).toContain('HTTP 502')
  })

  it('ignora campo longo demais para ser um código', async () => {
    // Defesa contra um provedor que ponha a mensagem inteira em `error`.
    responderCom(403, { error: `recusado porque ${DESTINATARIO} não está autorizado nesta conta de teste` })

    await enviarEmail(email)

    expect(registrado.join('\n')).not.toContain(DESTINATARIO)
  })
})

describe('envio aceito', () => {
  it('não registra nada quando o provedor aceita', async () => {
    responderCom(200, { id: 'abc' })

    const resultado = await enviarEmail(email)

    expect(resultado).toEqual({ ok: true, transporte: 'http' })
    expect(registrado).toEqual([])
  })
})
