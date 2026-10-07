/**
 * Sincroniza /content (fonte da verdade) com as tabelas espelho do banco.
 *
 *   npm run content:sync
 *
 * Por que existe: o conteudo e JSON versionado no Git, mas filtros, buscas e
 * relacoes (tentativa -> questao, submissao -> demanda) precisam de tabela.
 * Este script e idempotente e nunca toca em dado de usuario. Demandas geradas
 * por IA (ownerId preenchido) sao preservadas.
 *
 * Rode sempre que adicionar ou editar um arquivo de conteudo.
 */
import { PrismaClient } from '@prisma/client'

import { reloadContent } from '../src/lib/content/loader'

const db = new PrismaClient()

async function main() {
  const content = reloadContent()

  if (content.issues.length > 0) {
    console.error(`\n${content.issues.length} problema(s) de conteúdo encontrados:\n`)
    for (const issue of content.issues) {
      console.error(`  ${issue.file}: ${issue.message}`)
    }
    console.error('\nCorrija os arquivos antes de sincronizar.')
    process.exitCode = 1
    return
  }

  const now = new Date()
  const counts = { modules: 0, lessons: 0, exercises: 0, assessments: 0, questions: 0 }

  for (const modulo of content.modules) {
    await db.module.upsert({
      where: { id: modulo.id },
      create: {
        id: modulo.id,
        semester: modulo.semester,
        title: modulo.title,
        summary: modulo.summary,
        order: modulo.order,
        tags: JSON.stringify(modulo.tags),
        minutes: modulo.totalMinutes,
        itemCount: modulo.items.length,
        syncedAt: now,
      },
      update: {
        semester: modulo.semester,
        title: modulo.title,
        summary: modulo.summary,
        order: modulo.order,
        tags: JSON.stringify(modulo.tags),
        minutes: modulo.totalMinutes,
        itemCount: modulo.items.length,
        syncedAt: now,
      },
    })
    counts.modules += 1

    for (const [index, item] of modulo.items.entries()) {
      const data = {
        moduleId: modulo.id,
        title: item.title,
        summary: item.type === 'lesson' ? item.why : item.summary,
        kind: item.type === 'lesson' ? (item.exercise ? 'exercise' : 'lesson') : 'checkpoint',
        order: index,
        minutes: item.estimatedMinutes,
        tags: JSON.stringify(item.tags),
        hasExercise: item.type === 'lesson' && Boolean(item.exercise),
        syncedAt: now,
      }

      await db.lesson.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data })
      counts.lessons += 1

      if (item.type === 'lesson' && item.exercise) {
        const exercise = {
          lessonId: item.id,
          moduleId: modulo.id,
          title: item.exercise.title,
          kind: item.exercise.kind,
          language: item.exercise.language,
          minutes: item.exercise.estimatedMinutes,
          syncedAt: now,
        }
        await db.exercise.upsert({
          where: { id: item.exercise.id },
          create: { id: item.exercise.id, ...exercise },
          update: exercise,
        })
        counts.exercises += 1
      }
    }

    for (const assessment of modulo.assessments) {
      const data = {
        moduleId: modulo.id,
        title: assessment.title,
        summary: assessment.summary,
        format: assessment.format,
        minutes: assessment.estimatedMinutes,
        itemCount: assessment.questions.length,
        topics: JSON.stringify(assessment.topics),
        syncedAt: now,
      }
      await db.assessment.upsert({
        where: { id: assessment.id },
        create: { id: assessment.id, ...data },
        update: data,
      })
      counts.assessments += 1

      for (const [index, question] of assessment.questions.entries()) {
        const questionData = { assessmentId: assessment.id, order: index, kind: question.kind, syncedAt: now }
        await db.question.upsert({
          where: { id: question.id },
          create: { id: question.id, ...questionData },
          update: questionData,
        })
        counts.questions += 1
      }
    }
  }

  for (const demand of content.demands) {
    const data = {
      title: demand.title,
      type: demand.type,
      difficulty: demand.difficulty,
      minutes: demand.estimatedMinutes,
      summary: demand.summary,
      stack: JSON.stringify(demand.stack),
      moduleIds: JSON.stringify(demand.moduleIds),
      contextQuality: demand.contextQuality,
      generated: false,
      ownerId: null,
      payload: null,
      syncedAt: now,
    }
    await db.demand.upsert({ where: { id: demand.id }, create: { id: demand.id, ...data }, update: data })
  }

  for (const project of content.projects) {
    const data = {
      title: project.title,
      summary: project.summary,
      difficulty: project.difficulty,
      stack: JSON.stringify(project.stack),
      stepCount: project.steps.length,
      minutes: project.steps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
      syncedAt: now,
    }
    await db.project.upsert({ where: { id: project.id }, create: { id: project.id, ...data }, update: data })
  }

  for (const challenge of content.challenges) {
    const data = {
      title: challenge.title,
      format: challenge.format,
      category: challenge.category,
      difficulty: challenge.difficulty,
      minutes: challenge.estimatedMinutes,
      summary: challenge.objective.slice(0, 200),
      stack: JSON.stringify(challenge.stack),
      syncedAt: now,
    }
    await db.challenge.upsert({
      where: { id: challenge.id },
      create: { id: challenge.id, ...data },
      update: data,
    })
  }

  for (const term of content.glossary) {
    const data = { term: term.term, short: term.short, tags: JSON.stringify(term.tags), syncedAt: now }
    await db.glossaryTerm.upsert({ where: { id: term.id }, create: { id: term.id, ...data }, update: data })
  }

  // Remove espelhos de conteudo que nao existe mais. Dado de usuario que
  // aponta para eles cai por cascade, por isso a remocao e explicita e visivel.
  const removed = await removeStale(content)

  console.log('Conteúdo sincronizado:')
  console.log(`  módulos: ${counts.modules}`)
  console.log(`  itens: ${counts.lessons}`)
  console.log(`  exercícios: ${counts.exercises}`)
  console.log(`  avaliações: ${counts.assessments} (${counts.questions} questões)`)
  console.log(`  demandas: ${content.demands.length}`)
  console.log(`  projetos: ${content.projects.length}`)
  console.log(`  desafios: ${content.challenges.length}`)
  console.log(`  glossário: ${content.glossary.length}`)
  if (removed > 0) console.log(`  registros removidos (conteúdo apagado): ${removed}`)
}

async function removeStale(content: ReturnType<typeof reloadContent>): Promise<number> {
  const keepModules = content.modules.map((m) => m.id)
  const keepItems = content.modules.flatMap((m) => m.items.map((item) => item.id))
  const keepExercises = content.modules.flatMap((m) =>
    m.items.flatMap((item) => (item.type === 'lesson' && item.exercise ? [item.exercise.id] : [])),
  )
  const keepAssessments = content.modules.flatMap((m) => m.assessments.map((a) => a.id))
  const keepQuestions = content.modules.flatMap((m) =>
    m.assessments.flatMap((a) => a.questions.map((q) => q.id)),
  )

  const results = await Promise.all([
    db.question.deleteMany({ where: { id: { notIn: keepQuestions } } }),
    db.assessment.deleteMany({ where: { id: { notIn: keepAssessments } } }),
    db.exercise.deleteMany({ where: { id: { notIn: keepExercises } } }),
    db.lesson.deleteMany({ where: { id: { notIn: keepItems } } }),
    db.module.deleteMany({ where: { id: { notIn: keepModules } } }),
    // Demandas geradas por IA nao vem de /content e por isso nao entram aqui.
    db.demand.deleteMany({ where: { generated: false, id: { notIn: content.demands.map((d) => d.id) } } }),
    db.project.deleteMany({ where: { id: { notIn: content.projects.map((p) => p.id) } } }),
    db.challenge.deleteMany({ where: { id: { notIn: content.challenges.map((c) => c.id) } } }),
    db.glossaryTerm.deleteMany({ where: { id: { notIn: content.glossary.map((t) => t.id) } } }),
  ])

  return results.reduce((sum, result) => sum + result.count, 0)
}

main()
  .catch((error) => {
    console.error('Falha ao sincronizar conteúdo:', error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
