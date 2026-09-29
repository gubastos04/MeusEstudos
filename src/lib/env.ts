import { z } from 'zod'

/**
 * Configuracao do servidor.
 *
 * Regras:
 * - este modulo nunca pode ser importado por codigo de cliente;
 * - falta de ANTHROPIC_API_KEY nao e erro: a IA simplesmente fica desligada;
 * - APP_SECRET ausente e erro fatal em producao e aviso em dev/test.
 */

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatorio'),
  APP_SECRET: z.string().default(''),
  APP_URL: z.string().default(''),
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
  PERMITIR_CADASTRO: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  // Email: usado apenas no link de redefinicao de senha.
  MAIL_TRANSPORTE: z.enum(['auto', 'console', 'http']).default('auto'),
  MAIL_HTTP_URL: z.string().default(''),
  MAIL_HTTP_TOKEN: z.string().default(''),
  MAIL_FROM: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  IA_MODELO: z.string().default('claude-sonnet-5'),
  IA_LIMITE_DIARIO: z.coerce.number().int().min(0).default(40),
  IA_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45_000),
  IA_MAX_TOKENS: z.coerce.number().int().min(256).max(8192).default(1200),
})

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me-please-32'

function read() {
  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Configuracao invalida. ${issues}`)
  }

  const data = parsed.data
  const isProd = data.NODE_ENV === 'production'

  let secret = data.APP_SECRET
  if (secret.length < 32) {
    if (isProd) {
      throw new Error(
        'APP_SECRET precisa de pelo menos 32 caracteres em producao. Gere com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
      )
    }
    if (secret.length > 0) {
      console.warn('[env] APP_SECRET curto. Usando valor de desenvolvimento.')
    }
    secret = DEV_FALLBACK_SECRET
  }

  return {
    ...data,
    APP_SECRET: secret,
    isProd,
    /** A IA do servidor esta configurada? Usuarios podem ter chave propria mesmo com isto falso. */
    serverAiConfigured: data.ANTHROPIC_API_KEY.startsWith('sk-'),
  }
}

let cached: ReturnType<typeof read> | null = null

export function env() {
  if (!cached) cached = read()
  return cached
}

/** Usado apenas nos testes, quando process.env muda entre casos. */
export function resetEnvCache() {
  cached = null
}
