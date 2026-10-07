#!/usr/bin/env node
/**
 * Sincroniza /content no banco de producao e devolve o repositorio ao estado
 * local, mesmo se algo falhar no meio.
 *
 *   $env:DATABASE_URL = "<url do Neon>"   # PowerShell
 *   DATABASE_URL="<url do Neon>" \        # shell POSIX
 *   npm run sync:producao
 *
 * O script NAO recebe nem guarda a URL: ela vem do ambiente, que e de onde o
 * Prisma le primeiro. Argumento iria para o historico do shell e arquivo iria
 * para o disco, e a URL de producao nao deve ficar em nenhum dos dois.
 *
 * O que ele resolve e a parte que erra na mao: a ordem dos seis passos e o
 * retorno ao sqlite. Trocar o provider deixa no disco um client gerado para
 * PostgreSQL, e um client assim aceita a URL do banco para o qual foi gerado e
 * grava no lugar errado em silencio. Se o sync falha no meio, essa sujeira
 * fica — por isso a restauracao mora num `finally`, nao no fim do caminho
 * felizes.
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function rodar(comando, argumentos) {
  console.log(`\n$ ${comando} ${argumentos.join(' ')}`)
  const r = spawnSync(comando, argumentos, { cwd: raiz, stdio: 'inherit', shell: true })
  if (r.status !== 0) throw new Error(`falhou: ${comando} ${argumentos.join(' ')}`)
}

/** Identifica o banco sem imprimir a credencial: so host e nome. */
function descrever(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`
  } catch {
    return '(URL em formato não reconhecido)'
  }
}

async function confirmar(pergunta) {
  // Sem TTY (CI, pipe) nao ha quem responda: seguir travaria o processo.
  if (!process.stdin.isTTY) {
    console.log('(sem terminal interativo; seguindo sem confirmar)')
    return true
  }
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const resposta = await new Promise((ok) => leitor.question(pergunta, ok))
    return resposta.trim().toLowerCase() === 's'
  } finally {
    leitor.close()
  }
}

const url = process.env.DATABASE_URL

if (!url) {
  console.error(
    'DATABASE_URL não está definida.\n\n' +
      'Defina-a na sessão do terminal, nunca no .env — a edição do arquivo\n' +
      'sobrevive ao fechamento do terminal, e o próximo content:sync que você\n' +
      'achar que é local escreve em produção.\n\n' +
      '  PowerShell:  $env:DATABASE_URL = "<url do Neon>"\n' +
      '  POSIX:       DATABASE_URL="<url do Neon>" npm run sync:producao',
  )
  process.exit(1)
}

if (url.startsWith('file:')) {
  console.error(
    'DATABASE_URL aponta para SQLite, então este é o banco local.\n' +
      'Para sincronizar o banco local, rode `npm run content:sync` direto.',
  )
  process.exit(1)
}

console.log(`Banco de destino: ${descrever(url)}`)

if (!(await confirmar('Sincronizar /content neste banco? (s/N) '))) {
  console.log('Cancelado. Nada foi alterado.')
  process.exit(0)
}

let erro = null
try {
  // deploy:preparar troca o provider, regenera o client e confere os tres.
  rodar('npm', ['run', 'deploy:preparar'])
  rodar('npm', ['run', 'content:sync'])
} catch (e) {
  erro = e
} finally {
  console.log('\n--- devolvendo o repositório ao estado local ---')
  try {
    rodar('npm', ['run', 'db:provider', 'sqlite'])
    rodar('npx', ['prisma', 'generate'])
  } catch (e) {
    // Falhar aqui e pior que falhar no sync: deixa um client de PostgreSQL no
    // disco. Dizer exatamente o que rodar a mao.
    console.error(
      '\nNÃO foi possível restaurar o estado local.\n' +
        'O client gerado ainda aponta para PostgreSQL. Rode à mão antes de\n' +
        'voltar a desenvolver:\n\n' +
        '  npm run db:provider sqlite\n' +
        '  npx prisma generate\n',
    )
    process.exit(1)
  }
}

if (erro) {
  console.error(`\n${erro.message}`)
  console.error(
    'O estado local foi restaurado. O banco de produção pode ter ficado\n' +
      'parcialmente sincronizado: confira as contagens antes de concluir.',
  )
  process.exit(1)
}

console.log(
  '\nSincronizado, e o repositório voltou ao sqlite.\n' +
    'Confira as contagens no banco em vez de confiar nesta saída: foi um\n' +
    'relato de sucesso que escondeu um sync escrito no banco errado.',
)
