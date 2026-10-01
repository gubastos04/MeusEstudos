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
  console.log(`schema: ${doSchema}  |  client gerado: ${doClient}`)

  if (doSchema !== doClient) {
    console.error(
      `\nO client foi gerado para "${doClient}", mas o schema diz "${doSchema}".\n` +
        'Qualquer comando que acesse o banco vai usar o client velho e pode gravar\n' +
        'no banco errado sem dar erro. Rode `npx prisma generate` antes de seguir.',
    )
    process.exit(1)
  }

  console.log('ok: o client corresponde ao schema.')
  process.exit(0)
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
