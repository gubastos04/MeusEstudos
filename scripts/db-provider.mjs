#!/usr/bin/env node
/**
 * Troca o provider do datasource em prisma/schema.prisma.
 *
 *   npm run db:provider postgresql   # antes do deploy
 *   npm run db:provider sqlite       # volta para o dev local
 *
 * Existe porque o Prisma nao aceita env() no campo `provider`, e o projeto usa
 * SQLite em dev e PostgreSQL em producao com um unico schema (nenhum enum e
 * nenhum campo Json, para manter compatibilidade entre os dois).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const VALID = new Set(['sqlite', 'postgresql'])
const target = process.argv[2]

if (!target || !VALID.has(target)) {
  console.error(`Uso: npm run db:provider <${[...VALID].join('|')}>`)
  process.exit(1)
}

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma')
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
