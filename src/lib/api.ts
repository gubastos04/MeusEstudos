import { NextResponse } from 'next/server'
import { z } from 'zod'

import { currentUser } from './auth'
import { env } from './env'
import type { SessionUser } from './session'

/**
 * Utilitarios para as rotas de API.
 *
 * Padrao de resposta:
 *   sucesso -> { ok: true, ...dados }
 *   erro    -> { ok: false, erro: "mensagem para a pessoa", campo?: "nome" }
 *
 * Toda rota mutavel passa por `handler` com `requireAuth` (default) e checagem
 * de Origin, que e a protecao de CSRF do projeto: o cookie e SameSite=Lax e
 * requisicoes de outra origem sao recusadas antes de qualquer escrita.
 */

export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status })
}

export function fail(erro: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, erro, ...extra }, { status })
}

export class ApiError extends Error {
  status: number
  extra?: Record<string, unknown>

  constructor(message: string, status = 400, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Recusa requisicoes mutaveis vindas de outra origem. */
export function sameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true

  const origin = request.headers.get('origin')
  // Clientes nao-browser (ex.: testes de integracao) nao mandam Origin.
  if (!origin) return true

  const allowed = new Set<string>()
  const configured = env().APP_URL
  if (configured) {
    try {
      allowed.add(new URL(configured).origin)
    } catch {
      // APP_URL mal formado: ignorado, a origem do host ainda e aceita.
    }
  }

  const host = request.headers.get('host')
  if (host) {
    allowed.add(`https://${host}`)
    if (!env().isProd) allowed.add(`http://${host}`)
  }

  return allowed.has(origin)
}

type HandlerContext<TBody, TUser> = {
  request: Request
  user: TUser
  body: TBody
  params: Record<string, string>
}

type HandlerOptions<TSchema extends z.ZodTypeAny | undefined, TAuth extends boolean> = {
  schema?: TSchema
  requireAuth?: TAuth
}

type Inferred<TSchema> = TSchema extends z.ZodTypeAny ? z.infer<TSchema> : undefined

/**
 * Rota com sessao recebe `user` garantido; rota que dispensa sessao recebe
 * `SessionUser | null` e o compilador cobra a checagem.
 *
 * Antes, o wrapper entregava um usuario falso com `id: ''` nesse caso. Nenhuma
 * rota chegou a usar, mas uma futura consultaria com userId vazio em silencio,
 * sem erro de tipo — o tipo de furo de isolamento que nao aparece em review.
 */
type UsuarioDoHandler<TAuth extends boolean> = TAuth extends false ? SessionUser | null : SessionUser

/**
 * Envolve um handler de rota com: checagem de origem, sessao, validacao do
 * corpo e tratamento de erro. Erros inesperados nunca vazam stack para o cliente.
 */
export function handler<TSchema extends z.ZodTypeAny | undefined = undefined, TAuth extends boolean = true>(
  options: HandlerOptions<TSchema, TAuth>,
  run: (
    ctx: HandlerContext<Inferred<TSchema>, UsuarioDoHandler<TAuth>>,
  ) => Promise<NextResponse> | NextResponse,
) {
  // O segundo argumento e declarado como obrigatorio porque e assim que o Next
  // tipa os route handlers; em rotas sem parametro ele chega sem `params`.
  return async function route(
    request: Request,
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> {
    try {
      if (!sameOrigin(request)) {
        return fail('Requisicao recusada: origem invalida.', 403)
      }

      let user: SessionUser | null = null
      if (options.requireAuth !== false) {
        user = await currentUser()
        if (!user) return fail('Sua sessao expirou. Entre novamente.', 401)
      }

      let body: unknown = undefined
      if (options.schema) {
        const raw = await readBody(request)
        const parsed = options.schema.safeParse(raw)
        if (!parsed.success) {
          const first = parsed.error.issues[0]
          return fail(first?.message ?? 'Dados invalidos.', 422, {
            campo: first?.path.join('.') || undefined,
          })
        }
        body = parsed.data
      }

      const params = routeContext?.params ? await routeContext.params : {}

      return await run({
        request,
        // Com sessao exigida, o caminho acima ja retornou 401 se nao houvesse
        // usuario — aqui ele existe. Sem sessao exigida, vai null mesmo.
        user: user as UsuarioDoHandler<TAuth>,
        body: body as Inferred<TSchema>,
        params,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.message, error.status, error.extra)
      }
      console.error('[api] erro nao tratado', error)
      return fail('Algo deu errado do nosso lado. Tente novamente.', 500)
    }
  }
}

async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? ''

  if (type.includes('application/json')) {
    const text = await request.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      throw new ApiError('Corpo da requisicao nao e um JSON valido.', 400)
    }
  }

  if (type.includes('form')) {
    const form = await request.formData()
    return Object.fromEntries(form.entries())
  }

  return {}
}
