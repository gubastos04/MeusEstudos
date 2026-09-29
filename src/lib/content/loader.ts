import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'

import {
  assessmentSchema,
  challengeFileSchema,
  demandFileSchema,
  glossaryFileSchema,
  moduleSchema,
  projectFileSchema,
  trackFileSchema,
  type Assessment,
  type Challenge,
  type ContentModule,
  type Demand,
  type GlossaryTerm,
  type Lesson,
  type ModuleItem,
  type Project,
  type Track,
} from './schema'

/**
 * Leitor do conteudo em /content.
 *
 * Regras:
 * - le do disco uma vez por processo e guarda em cache (em dev o cache cai a
 *   cada recarga de modulo do Next, o que da edicao-e-ver sem reiniciar);
 * - arquivo invalido NAO derruba o app: entra em `issues` e o resto carrega;
 * - nenhuma escrita. O conteudo e versionado no Git.
 */

export type ContentIssue = {
  file: string
  message: string
}

export type LoadedModule = ContentModule & {
  /** Caminho do arquivo de origem, util para mensagens de erro. */
  sourceFile: string
  totalMinutes: number
}

export type ContentBundle = {
  modules: LoadedModule[]
  demands: Demand[]
  projects: Project[]
  challenges: Challenge[]
  glossary: GlossaryTerm[]
  tracks: Track[]
  issues: ContentIssue[]
}

const CONTENT_DIR = process.env.CONTENT_DIR ?? join(process.cwd(), 'content')

const globalForContent = globalThis as unknown as { contentBundle?: ContentBundle }

function readJsonFile(path: string): unknown {
  const raw = readFileSync(path, 'utf8')
  return JSON.parse(raw)
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(dir, entry.name))
    .sort()
}

function formatIssue(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as z.ZodError).issues.slice(0, 4)
    return issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join(' | ')
  }
  return error instanceof Error ? error.message : String(error)
}

function relative(path: string): string {
  return path.replace(CONTENT_DIR, 'content').replace(/\\/g, '/')
}

function load(): ContentBundle {
  const issues: ContentIssue[] = []
  const modules: LoadedModule[] = []
  const seenIds = new Map<string, string>()

  const claimId = (value: string, file: string): boolean => {
    const previous = seenIds.get(value)
    if (previous) {
      issues.push({ file: relative(file), message: `id duplicado "${value}" (ja usado em ${previous})` })
      return false
    }
    seenIds.set(value, relative(file))
    return true
  }

  // Modulos: content/semestre-N/*.json
  for (const semester of [1, 2, 3, 4]) {
    for (const file of listJsonFiles(join(CONTENT_DIR, `semestre-${semester}`))) {
      try {
        const parsed = moduleSchema.safeParse(readJsonFile(file))
        if (!parsed.success) {
          issues.push({ file: relative(file), message: formatIssue(parsed.error) })
          continue
        }
        if (parsed.data.semester !== semester) {
          issues.push({
            file: relative(file),
            message: `semester ${parsed.data.semester} nao corresponde a pasta semestre-${semester}`,
          })
          continue
        }
        if (!claimId(parsed.data.id, file)) continue

        const duplicateItem = findDuplicate(parsed.data.items.map((item) => item.id))
        if (duplicateItem) {
          issues.push({ file: relative(file), message: `item com id repetido "${duplicateItem}"` })
          continue
        }

        const answerProblem = validateAnswerIndexes(parsed.data)
        if (answerProblem) {
          issues.push({ file: relative(file), message: answerProblem })
          continue
        }

        modules.push({
          ...parsed.data,
          sourceFile: relative(file),
          totalMinutes: parsed.data.items.reduce((sum, item) => sum + item.estimatedMinutes, 0),
        })
      } catch (error) {
        issues.push({ file: relative(file), message: formatIssue(error) })
      }
    }
  }

  modules.sort((a, b) => a.semester - b.semester || a.order - b.order || a.title.localeCompare(b.title))

  const demands = loadCollection(join(CONTENT_DIR, 'demandas'), demandFileSchema, (data) => data.demands, issues)
  const projects = loadCollection(join(CONTENT_DIR, 'projetos'), projectFileSchema, (data) => data.projects, issues)
  const challenges = loadCollection(
    join(CONTENT_DIR, 'desafios'),
    challengeFileSchema,
    (data) => data.challenges,
    issues,
  )
  const glossary = loadSingle(join(CONTENT_DIR, 'glossario.json'), glossaryFileSchema, (d) => d.terms, issues)
  const tracks = loadSingle(join(CONTENT_DIR, 'trilhas.json'), trackFileSchema, (d) => d.tracks, issues)

  // Referencias cruzadas: um id de modulo errado numa demanda vira link morto.
  const moduleIds = new Set(modules.map((m) => m.id))
  for (const demand of demands) {
    for (const moduleId of demand.moduleIds) {
      if (!moduleIds.has(moduleId)) {
        issues.push({ file: `demanda ${demand.id}`, message: `moduleId inexistente "${moduleId}"` })
      }
    }
  }
  for (const project of projects) {
    for (const step of project.steps) {
      for (const moduleId of step.moduleIds) {
        if (!moduleIds.has(moduleId)) {
          issues.push({
            file: `projeto ${project.id}`,
            message: `etapa ${step.id}: moduleId inexistente "${moduleId}"`,
          })
        }
      }
    }
  }

  glossary.sort((a, b) => a.term.localeCompare(b.term, 'pt-BR'))

  if (issues.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(`[conteudo] ${issues.length} problema(s) encontrado(s). Veja /admin/conteudo.`)
  }

  return { modules, demands, projects, challenges, glossary, tracks, issues }
}

function findDuplicate(values: string[]): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}

/** answerIndex tem de apontar para uma alternativa existente. */
function validateAnswerIndexes(modulo: ContentModule): string | null {
  for (const item of modulo.items) {
    if (item.type !== 'lesson') continue
    for (const [index, block] of item.blocks.entries()) {
      if (block.kind === 'quiz' && block.answerIndex >= block.choices.length) {
        return `${item.id}: bloco ${index} tem answerIndex fora das alternativas`
      }
    }
    const exercise = item.exercise
    if (exercise?.kind === 'quiz') {
      if (!exercise.choices || exercise.answerIndex === undefined) {
        return `${exercise.id}: exercicio quiz precisa de choices e answerIndex`
      }
      if (exercise.answerIndex >= exercise.choices.length) {
        return `${exercise.id}: answerIndex fora das alternativas`
      }
    }
    if (exercise?.kind === 'code' && exercise.tests.length === 0 && exercise.checks.length === 0) {
      return `${exercise.id}: exercicio de codigo precisa de tests ou checks`
    }
  }

  for (const assessment of modulo.assessments) {
    for (const question of assessment.questions) {
      if (question.kind !== 'pratica' && question.answerIndex >= question.choices.length) {
        return `${assessment.id}/${question.id}: answerIndex fora das alternativas`
      }
      if (question.kind === 'pratica' && question.tests.length === 0 && question.checks.length === 0) {
        return `${assessment.id}/${question.id}: questao pratica precisa de tests ou checks`
      }
    }
  }

  return null
}

function loadCollection<TSchema extends z.ZodTypeAny, TItem>(
  dir: string,
  schema: TSchema,
  pick: (data: z.infer<TSchema>) => TItem[],
  issues: ContentIssue[],
): TItem[] {
  const out: TItem[] = []
  for (const file of listJsonFiles(dir)) {
    try {
      const parsed = schema.safeParse(readJsonFile(file))
      if (!parsed.success) {
        issues.push({ file: relative(file), message: formatIssue(parsed.error) })
        continue
      }
      out.push(...pick(parsed.data))
    } catch (error) {
      issues.push({ file: relative(file), message: formatIssue(error) })
    }
  }
  return out
}

function loadSingle<TSchema extends z.ZodTypeAny, TItem>(
  file: string,
  schema: TSchema,
  pick: (data: z.infer<TSchema>) => TItem[],
  issues: ContentIssue[],
): TItem[] {
  if (!existsSync(file)) return []
  try {
    const parsed = schema.safeParse(readJsonFile(file))
    if (!parsed.success) {
      issues.push({ file: relative(file), message: formatIssue(parsed.error) })
      return []
    }
    return pick(parsed.data)
  } catch (error) {
    issues.push({ file: relative(file), message: formatIssue(error) })
    return []
  }
}

export function getContent(): ContentBundle {
  if (!globalForContent.contentBundle) {
    globalForContent.contentBundle = load()
  }
  return globalForContent.contentBundle
}

/** Forca nova leitura do disco. Usado nos testes e no script de validacao. */
export function reloadContent(): ContentBundle {
  globalForContent.contentBundle = load()
  return globalForContent.contentBundle
}

// --- Consultas ---------------------------------------------------------------

export function getModules(): LoadedModule[] {
  return getContent().modules
}

export function getModule(moduleId: string): LoadedModule | null {
  return getModules().find((m) => m.id === moduleId) ?? null
}

export function getModulesBySemester(): { semester: number; modules: LoadedModule[] }[] {
  const grouped = new Map<number, LoadedModule[]>()
  for (const modulo of getModules()) {
    const list = grouped.get(modulo.semester) ?? []
    list.push(modulo)
    grouped.set(modulo.semester, list)
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semester, modules]) => ({ semester, modules }))
}

export type ItemLocation = {
  module: LoadedModule
  item: ModuleItem
  index: number
  previous: ModuleItem | null
  next: ModuleItem | null
}

export function findItem(itemId: string): ItemLocation | null {
  for (const modulo of getModules()) {
    const index = modulo.items.findIndex((item) => item.id === itemId)
    if (index === -1) continue
    return {
      module: modulo,
      item: modulo.items[index]!,
      index,
      previous: index > 0 ? modulo.items[index - 1]! : null,
      next: index < modulo.items.length - 1 ? modulo.items[index + 1]! : null,
    }
  }
  return null
}

export function getLesson(itemId: string): (Lesson & { moduleId: string }) | null {
  const found = findItem(itemId)
  if (!found || found.item.type !== 'lesson') return null
  return { ...found.item, moduleId: found.module.id }
}

/** Todos os exercicios do curriculo, com o modulo e a aula de origem. */
export function getAllExercises(): { moduleId: string; lessonId: string; exercise: NonNullable<Lesson['exercise']> }[] {
  const out: { moduleId: string; lessonId: string; exercise: NonNullable<Lesson['exercise']> }[] = []
  for (const modulo of getModules()) {
    for (const item of modulo.items) {
      if (item.type === 'lesson' && item.exercise) {
        out.push({ moduleId: modulo.id, lessonId: item.id, exercise: item.exercise })
      }
    }
  }
  return out
}

export function findExercise(exerciseId: string) {
  return getAllExercises().find((entry) => entry.exercise.id === exerciseId) ?? null
}

export function getAssessments(): (Assessment & { moduleId: string })[] {
  return getModules().flatMap((modulo) =>
    modulo.assessments.map((assessment) => ({ ...assessment, moduleId: modulo.id })),
  )
}

export function getAssessment(assessmentId: string): (Assessment & { moduleId: string }) | null {
  const parsed = assessmentSchema.shape.id.safeParse(assessmentId)
  if (!parsed.success) return null
  return getAssessments().find((assessment) => assessment.id === assessmentId) ?? null
}

export function getDemands(): Demand[] {
  return getContent().demands
}

export function getDemand(demandId: string): Demand | null {
  return getDemands().find((demand) => demand.id === demandId) ?? null
}

export function getProjects(): Project[] {
  return getContent().projects
}

export function getProject(projectId: string): Project | null {
  return getProjects().find((project) => project.id === projectId) ?? null
}

export function getChallenges(): Challenge[] {
  return getContent().challenges
}

export function getChallenge(challengeId: string): Challenge | null {
  return getChallenges().find((challenge) => challenge.id === challengeId) ?? null
}

export function getGlossary(): GlossaryTerm[] {
  return getContent().glossary
}

export function findGlossaryTerm(idOrTerm: string): GlossaryTerm | null {
  const needle = idOrTerm.toLowerCase()
  return (
    getGlossary().find((term) => term.id === needle || term.term.toLowerCase() === needle) ?? null
  )
}

export function searchGlossary(query: string): GlossaryTerm[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return getGlossary()
  return getGlossary().filter((term) => {
    const haystack = [term.term, term.short, term.explanation, ...term.tags, ...term.related]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function getTracks(): Track[] {
  return getContent().tracks
}

export function getTrack(trackId: string): Track | null {
  return getTracks().find((track) => track.id === trackId) ?? null
}

export function getContentIssues(): ContentIssue[] {
  return getContent().issues
}
