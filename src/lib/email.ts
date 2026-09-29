import { env } from './env'

/**
 * Envio de email.
 *
 * O produto precisa de um unico email: o link de redefinicao de senha. Por
 * isso nao ha dependencia de SDK nenhum — sao dois transportes:
 *
 * - `console`: escreve o email no log do servidor. Padrao em desenvolvimento,
 *   onde ninguem tem provedor configurado e o link precisa ficar acessivel.
 * - `http`: faz POST num provedor que aceite JSON (Resend, Postmark, uma
 *   funcao sua). Configurado por MAIL_HTTP_URL, MAIL_HTTP_TOKEN e MAIL_FROM.
 *
 * Sem transporte configurado em producao, o envio falha de forma explicita:
 * a rota registra e responde a mesma mensagem generica, e o log diz o motivo.
 * Nada de fingir que enviou.
 */

export type Email = {
  para: string
  assunto: string
  texto: string
}

export type ResultadoEnvio =
  | { ok: true; transporte: 'console' | 'http' }
  | { ok: false; motivo: string }

function transporteEscolhido(): 'console' | 'http' | 'nenhum' {
  const configurado = env().MAIL_TRANSPORTE

  if (configurado === 'http') return 'http'
  if (configurado === 'console') return 'console'

  // Automatico: HTTP quando ha provedor, console fora de producao.
  if (env().MAIL_HTTP_URL) return 'http'
  return env().isProd ? 'nenhum' : 'console'
}

export async function enviarEmail(email: Email): Promise<ResultadoEnvio> {
  const transporte = transporteEscolhido()

  if (transporte === 'nenhum') {
    console.error(
      '[email] nenhum transporte configurado. Defina MAIL_HTTP_URL (e MAIL_HTTP_TOKEN) ou MAIL_TRANSPORTE=console.',
    )
    return { ok: false, motivo: 'transporte não configurado' }
  }

  if (transporte === 'console') {
    // Formato de bloco para o link ser fácil de achar no meio do log.
    console.info(
      [
        '',
        '─────────────── email (transporte: console) ───────────────',
        `para:    ${email.para}`,
        `assunto: ${email.assunto}`,
        '',
        email.texto,
        '───────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return { ok: true, transporte: 'console' }
  }

  const url = env().MAIL_HTTP_URL
  const remetente = env().MAIL_FROM

  if (!url || !remetente) {
    console.error('[email] MAIL_HTTP_URL e MAIL_FROM são obrigatórios no transporte http.')
    return { ok: false, motivo: 'transporte http incompleto' }
  }

  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), 15_000)

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      signal: controle.signal,
      headers: {
        'content-type': 'application/json',
        ...(env().MAIL_HTTP_TOKEN ? { authorization: `Bearer ${env().MAIL_HTTP_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        from: remetente,
        to: email.para,
        subject: email.assunto,
        text: email.texto,
      }),
    })

    if (!resposta.ok) {
      // O corpo do provedor pode conter dado do destinatário: só o status vai para o log.
      console.error(`[email] provedor recusou o envio (HTTP ${resposta.status})`)
      return { ok: false, motivo: `provedor respondeu ${resposta.status}` }
    }

    return { ok: true, transporte: 'http' }
  } catch (erro) {
    const abortado = erro instanceof Error && erro.name === 'AbortError'
    console.error(`[email] falha no envio: ${abortado ? 'timeout' : 'erro de rede'}`)
    return { ok: false, motivo: abortado ? 'timeout' : 'erro de rede' }
  } finally {
    clearTimeout(relogio)
  }
}

/** Corpo do email de redefinicao. Texto puro: chega igual em qualquer cliente. */
export function emailDeRedefinicao(nome: string, link: string, minutos: number): Email {
  return {
    para: '',
    assunto: 'Redefinir sua senha — Meus Estudos',
    texto: [
      `Olá, ${nome}.`,
      '',
      'Alguém pediu para redefinir a senha da sua conta. Se foi você, abra o link abaixo:',
      '',
      link,
      '',
      `O link vale por ${minutos} minutos e só pode ser usado uma vez.`,
      '',
      'Se não foi você, ignore este email. Nada muda até o link ser usado.',
      '',
      'Meus Estudos',
    ].join('\n'),
  }
}
