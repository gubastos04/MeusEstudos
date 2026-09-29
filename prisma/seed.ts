/**
 * Semeia o banco de desenvolvimento.
 *
 *   npm run db:seed
 *
 * Cria uma conta de demonstracao com progresso, anotacao, erro registrado,
 * demanda em andamento e projeto iniciado. O motivo e pratico: um clone novo
 * cairia num painel vazio, e tela vazia esconde a maior parte dos problemas.
 *
 * Regras:
 * - idempotente: rodar de novo nao duplica nada;
 * - recusa rodar em producao, para nao criar conta de demonstracao la;
 * - a senha vem de SEED_DEMO_PASSWORD ou e sorteada e impressa uma unica vez.
 *   Nenhuma senha fixa fica no repositorio.
 */
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import type { ScryptOptions } from 'node:crypto'

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

// Mesmos parametros de src/lib/crypto.ts. Duplicados de proposito: o seed roda
// fora do Next e nao deve arrastar a configuracao da aplicacao junto.
async function hashPassword(senha: string): Promise<string> {
  const salt = randomBytes(16)
  const derivada = await scrypt(senha.normalize('NFKC'), salt, 64, {
    N: 2 ** 16,
    r: 8,
    p: 1,
    maxmem: 96 * 1024 * 1024,
  })

  return ['scrypt', 2 ** 16, 8, 1, salt.toString('base64url'), derivada.toString('base64url')].join('$')
}

const EMAIL_DEMO = 'demo@meusestudos.local'

/** Data no formato YYYY-MM-DD, deslocada em dias. */
function diaChave(deslocamento = 0): string {
  const data = new Date(Date.now() - deslocamento * 24 * 60 * 60 * 1000)
  return data.toISOString().slice(0, 10)
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed não roda em produção. Nenhuma conta de demonstração foi criada.')
    process.exitCode = 1
    return
  }

  const existente = await db.user.findUnique({ where: { email: EMAIL_DEMO } })
  const senhaInformada = process.env.SEED_DEMO_PASSWORD
  const senha = senhaInformada ?? randomBytes(12).toString('base64url')

  const usuario = existente
    ? await db.user.update({
        where: { id: existente.id },
        // Sem senha informada, a conta existente mantém a senha atual.
        data: senhaInformada ? { passwordHash: await hashPassword(senha) } : {},
      })
    : await db.user.create({
        data: {
          email: EMAIL_DEMO,
          name: 'Ana Demonstração',
          passwordHash: await hashPassword(senha),
        },
      })

  await db.userProfile.upsert({
    where: { userId: usuario.id },
    create: {
      userId: usuario.id,
      hasProgrammedBefore: 'pouco',
      knownLanguages: JSON.stringify(['Python', 'HTML e CSS']),
      usedGit: 'pouco',
      usedDatabase: 'nunca',
      typicalMinutes: 20,
      goal: 'primeiro_emprego',
      trackId: 'comeco-do-zero',
      onboardedAt: new Date(),
    },
    update: { onboardedAt: new Date(), trackId: 'comeco-do-zero' },
  })

  await db.userAIConfig.upsert({
    where: { userId: usuario.id },
    create: { userId: usuario.id },
    update: {},
  })

  // Progresso: dois itens concluídos e um retomado no meio.
  const concluidos = ['pc-programar-e-instruir-01', 'pc-decomposicao-01']
  for (const nodeId of concluidos) {
    await db.progress.upsert({
      where: { userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId } },
      create: {
        userId: usuario.id,
        nodeType: 'lesson',
        nodeId,
        moduleId: 'pensamento-computacional',
        status: 'completed',
        completedAt: new Date(),
        secondsSpent: 480,
      },
      update: {},
    })
  }

  await db.progress.upsert({
    where: {
      userId_nodeType_nodeId: { userId: usuario.id, nodeType: 'lesson', nodeId: 'pc-abstracao-01' },
    },
    create: {
      userId: usuario.id,
      nodeType: 'lesson',
      nodeId: 'pc-abstracao-01',
      moduleId: 'pensamento-computacional',
      status: 'in_progress',
      resumeBlock: 3,
      secondsSpent: 210,
    },
    update: {},
  })

  // Atividade: três dias ativos nos últimos sete. Dias sem registro ficam de
  // fora de propósito — é assim que a métrica funciona no produto.
  for (const [deslocamento, minutos] of [
    [0, 18],
    [2, 25],
    [5, 12],
  ] as const) {
    const day = diaChave(deslocamento)
    await db.activity.upsert({
      where: { userId_day: { userId: usuario.id, day } },
      create: { userId: usuario.id, day, minutes: minutos, lessonsCompleted: 1, exercisesAttempted: 1 },
      update: {},
    })
  }

  const exercicioId = 'ex-pc-pendentes-js-01'
  const jaTentou = await db.exerciseAttempt.findFirst({
    where: { userId: usuario.id, exerciseId: exercicioId },
  })

  if (!jaTentou) {
    await db.exerciseAttempt.create({
      data: {
        userId: usuario.id,
        exerciseId: exercicioId,
        lessonId: 'pc-algoritmo-em-passos-01',
        language: 'javascript',
        code: 'function pedidosPendentes(pedidos) {\n  // parei aqui\n}\n',
        passed: false,
        totalCases: 5,
        passedCases: 1,
        report: JSON.stringify([{ nome: 'lista vazia devolve lista vazia', passou: false, modo: 'execucao' }]),
      },
    })
  }

  const tituloErro = 'TypeError ao multiplicar quantidade nula'
  const erroExistente = await db.errorRecord.findFirst({
    where: { userId: usuario.id, title: tituloErro },
  })

  if (!erroExistente) {
    await db.errorRecord.create({
      data: {
        userId: usuario.id,
        title: tituloErro,
        context: 'Calculando o total de um pedido importado de planilha.',
        cause: 'A planilha trazia linhas sem a coluna quantidade, e o código multiplicava direto.',
        solution: 'Validar preço e quantidade antes de multiplicar e recusar o item com mensagem clara.',
        learning: 'Dado que vem de fora chega sujo. Validar na borda evita erro longe da causa.',
        code: 'total += item["preco"] * item["quantidade"]',
        language: 'python',
        technology: 'Python',
        tags: JSON.stringify(['python', 'validação']),
        resolved: true,
        moduleId: 'pensamento-computacional',
      },
    })
  }

  const tituloNota = 'Casos de borda que eu sempre esqueço'
  const notaExistente = await db.note.findFirst({ where: { userId: usuario.id, title: tituloNota } })

  if (!notaExistente) {
    await db.note.create({
      data: {
        userId: usuario.id,
        title: tituloNota,
        body: 'Vazio, um só, ausente/nulo, zero e negativo, tipo errado, repetido, grande.\n\nAntes de considerar pronto, escrever um teste para cada um que fizer sentido.',
        tags: JSON.stringify(['testes', 'qualidade']),
        pinned: true,
      },
    })
  }

  await db.demandSubmission.upsert({
    where: { userId_demandId: { userId: usuario.id, demandId: 'dem-filtro-pedidos' } },
    create: {
      userId: usuario.id,
      demandId: 'dem-filtro-pedidos',
      status: 'analisando',
      understanding:
        'O suporte precisa achar pedido antigo por status e período. Hoje a tela traz 200 pedidos sem filtro nenhum.',
      acceptance: JSON.stringify([true, false, false, false, false, false]),
    },
    update: {},
  })

  await db.projectProgress.upsert({
    where: { userId_projectId: { userId: usuario.id, projectId: 'proj-atendimento' } },
    create: {
      userId: usuario.id,
      projectId: 'proj-atendimento',
      currentStep: 2,
      doneSteps: JSON.stringify(['atend-etapa-1']),
      problem: 'Time de suporte perde chamado porque atende por email e planilha.',
    },
    update: {},
  })

  console.log('Banco semeado.')
  console.log(`  conta de demonstração: ${EMAIL_DEMO}`)

  if (existente && !senhaInformada) {
    console.log('  senha: mantida (defina SEED_DEMO_PASSWORD para trocar)')
  } else {
    console.log(`  senha: ${senha}`)
    console.log('  Anote agora: esta senha não é mostrada de novo.')
  }
}

main()
  .catch((erro) => {
    console.error('Falha ao semear:', erro)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
