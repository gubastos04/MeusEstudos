/**
 * Ambiente de cada arquivo de teste.
 *
 * Roda antes do modulo de teste ser importado, entao o banco e a configuracao
 * ja estao definidos quando src/lib/db.ts e src/lib/env.ts forem carregados.
 */

// NODE_ENV e somente leitura nos tipos do Next; aqui precisamos defini-lo
// antes de src/lib/env.ts ser carregado.
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.DATABASE_URL = 'file:./test-vitest.db'

// Valor fixo e proprio dos testes: assinatura de sessao e cifra da chave de IA
// precisam ser deterministicas entre casos.
process.env.APP_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-aqui'
process.env.APP_URL = 'http://localhost:3000'
process.env.APP_TIMEZONE = 'America/Sao_Paulo'
process.env.PERMITIR_CADASTRO = 'true'

// A suite roda com a IA desligada de proposito: o app precisa funcionar assim,
// e nenhum teste pode gastar chamada de verdade.
process.env.ANTHROPIC_API_KEY = ''
