#!/usr/bin/env node
/**
 * Troca o provider do datasource em prisma/schema.prisma.
 *
 *   npm run db:provider postgresql   # antes do deploy
 *   npm run db:provider sqlite       # volta para o dev local
 *   npm run db:conferir              # schema e client gerado combinam?
 *
 * Existe porque o Prisma nao aceita env() no campo `provider`, e o projeto usa
 * SQLite em dev e PostgreSQL em producao com um unico schema (nenhum enum e
 * nenhum campo Json, para manter compatibilidade entre os dois).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = resolve(raiz, 'prisma', 'schema.prisma')

const providerDe = (texto) => /provider\s*=\s*"(sqlite|postgresql)"/.exec(texto)?.[1] ?? null

/**
 * Trocar o provider no schema nao regenera o client, e um client velho nao
 * reclama: ele aceita a URL do banco para o qual foi gerado e grava no lugar
 * errado em silencio. Foi assim que um `content:sync` destinado a producao
 * escreveu no SQLite local relatando sucesso. Por isso a conferencia falha,
 * em vez de so avisar.
 */
function conferir() {
  const doSchema = providerDe(readFileSync(schemaPath, 'utf8'))
  const clientPath = resolve(raiz, 'node_modules', '.prisma', 'client', 'schema.prisma')

  if (!existsSync(clientPath)) {
    console.error('Client do Prisma não foi gerado ainda. Rode `npx prisma generate`.')
    process.exit(1)
  }

  const doClient = providerDe(readFileSync(clientPath, 'utf8'))
  const url = urlDoAmbiente()
  const dialeto = url === null ? null : url.startsWith('file:') ? 'sqlite' : 'postgresql'

  console.log(`schema: ${doSchema}  |  client gerado: ${doClient}  |  DATABASE_URL: ${dialeto ?? '(ausente)'}`)

  if (doSchema !== doClient) {
    console.error(
      `\nO client foi gerado para "${doClient}", mas o schema diz "${doSchema}".\n` +
        'Qualquer comando que acesse o banco vai usar o client velho e pode gravar\n' +
        'no banco errado sem dar erro. Rode `npx prisma generate` antes de seguir.',
    )
    process.exit(1)
  }

  // Schema e client podem concordar e a URL ainda ser do outro banco. O Prisma
  // so reclama disso quando a primeira consulta roda — ou seja, com a tela na
  // cara da pessoa. Falhar aqui antecipa o erro para antes de subir o servidor.
  if (dialeto !== null && dialeto !== doSchema) {
    console.error(
      `\nO provider é "${doSchema}", mas DATABASE_URL aponta para ${dialeto}.\n` +
        'A aplicação sobe e quebra na primeira consulta ao banco.',
    )
    process.exit(1)
  }

  console.log(
    dialeto === null
      ? 'ok: client e schema combinam. DATABASE_URL não definida — confira antes de rodar.'
      : 'ok: schema, client e DATABASE_URL combinam.',
  )
  process.exit(0)
}

/** DATABASE_URL do ambiente, com o .env como segunda opção — a ordem que o Prisma usa. */
function urlDoAmbiente() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const envPath = resolve(raiz, '.env')
  if (!existsSync(envPath)) return null

  const linha = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trimStart().startsWith('DATABASE_URL='))

  if (!linha) return null
  return linha.slice(linha.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
}

const VALID = new Set(['sqlite', 'postgresql'])
const target = process.argv[2]

if (target === '--conferir') conferir()

if (!target || !VALID.has(target)) {
  console.error(`Uso: npm run db:provider <${[...VALID].join('|')}>  |  npm run db:conferir`)
  process.exit(1)
}

const original = readFileSync(schemaPath, 'utf8')
const updated = original.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${target}"`,
)

if (updated === original) {
  console.log(`provider já era "${target}". Nada a fazer.`)
  process.exit(0)
}

writeFileSync(schemaPath, updated)
console.log(`provider alterado para "${target}".`)
console.log('Próximo passo: ajuste DATABASE_URL no .env e rode `npx prisma generate`.')
