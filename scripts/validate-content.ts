/**
 * Valida todo o conteudo em /content sem tocar no banco.
 *
 *   npm run content:validate
 *
 * Sai com codigo 1 quando ha problema, para poder rodar em CI.
 * Alem dos erros de schema, verifica regras do produto que nao cabem no zod:
 * aula longa, aula sem nada para fazer, modulo sem pratica.
 */
import { reloadContent } from '../src/lib/content/loader'

// Limites do produto: nada aqui e arbitrario, todos vem da spec.
const MAX_LESSON_MINUTES = 20
const MAX_BLOCKS_PER_LESSON = 14

function main() {
  const content = reloadContent()
  const errors: string[] = []
  const warnings: string[] = []

  for (const issue of content.issues) {
    errors.push(`${issue.file}: ${issue.message}`)
  }

  for (const modulo of content.modules) {
    const lessons = modulo.items.filter((item) => item.type === 'lesson')
    const withPractice = lessons.filter(
      (item) => item.type === 'lesson' && (item.exercise || item.tryNow),
    )

    if (lessons.length > 0 && withPractice.length === 0) {
      errors.push(`${modulo.id}: nenhum item tem exercício ou "tente agora". Conteúdo sem prática.`)
    }

    const practiceRatio = lessons.length === 0 ? 1 : withPractice.length / lessons.length
    if (practiceRatio < 0.5) {
      warnings.push(
        `${modulo.id}: só ${Math.round(practiceRatio * 100)}% das aulas têm prática. A regra do produto é prática > contexto > teoria.`,
      )
    }

    for (const item of modulo.items) {
      if (item.estimatedMinutes > MAX_LESSON_MINUTES) {
        errors.push(
          `${item.id}: ${item.estimatedMinutes} min estimados. O limite é ${MAX_LESSON_MINUTES} — quebre em dois itens.`,
        )
      }
      if (item.type === 'lesson' && item.blocks.length > MAX_BLOCKS_PER_LESSON) {
        warnings.push(`${item.id}: ${item.blocks.length} blocos. Acima de ${MAX_BLOCKS_PER_LESSON} a leitura fica longa.`)
      }
    }

    for (const assessment of modulo.assessments) {
      if (assessment.afterItemId && !modulo.items.some((item) => item.id === assessment.afterItemId)) {
        errors.push(`${assessment.id}: afterItemId "${assessment.afterItemId}" não existe no módulo.`)
      }
      if (assessment.format === 'alternativa') {
        const nonChoice = assessment.questions.filter((q) => q.kind === 'pratica')
        if (nonChoice.length > 0) {
          errors.push(`${assessment.id}: avaliação "alternativa" com questão prática.`)
        }
      }
      if (assessment.format === 'pratica') {
        const nonPractical = assessment.questions.filter((q) => q.kind !== 'pratica')
        if (nonPractical.length > 0) {
          errors.push(`${assessment.id}: avaliação "pratica" com questão de alternativa.`)
        }
      }
    }
  }

  // Glossario referenciado por aulas precisa existir.
  const glossaryIds = new Set(content.glossary.flatMap((term) => [term.id, term.term.toLowerCase()]))
  for (const modulo of content.modules) {
    for (const item of modulo.items) {
      if (item.type !== 'lesson') continue
      for (const reference of item.glossary) {
        if (!glossaryIds.has(reference.toLowerCase())) {
          errors.push(`${item.id}: termo de glossário "${reference}" não existe em content/glossario.json.`)
        }
      }
    }
  }

  // Termos relacionados do glossario tambem precisam existir.
  for (const term of content.glossary) {
    for (const related of term.related) {
      if (!glossaryIds.has(related.toLowerCase())) {
        warnings.push(`glossário "${term.term}": relacionado "${related}" não existe.`)
      }
    }
  }

  const totals = {
    módulos: content.modules.length,
    itens: content.modules.reduce((sum, m) => sum + m.items.length, 0),
    exercícios: content.modules.reduce(
      (sum, m) => sum + m.items.filter((i) => i.type === 'lesson' && i.exercise).length,
      0,
    ),
    avaliações: content.modules.reduce((sum, m) => sum + m.assessments.length, 0),
    demandas: content.demands.length,
    projetos: content.projects.length,
    desafios: content.challenges.length,
    glossário: content.glossary.length,
    trilhas: content.tracks.length,
  }

  console.log('Conteúdo carregado:')
  for (const [label, value] of Object.entries(totals)) {
    console.log(`  ${label}: ${value}`)
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} aviso(s):`)
    for (const warning of warnings) console.log(`  - ${warning}`)
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} erro(s):`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exitCode = 1
    return
  }

  console.log('\nNenhum erro de conteúdo.')
}

main()
