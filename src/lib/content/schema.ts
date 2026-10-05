import { z } from 'zod'

/**
 * Schema do conteudo educacional (/content).
 *
 * Duas garantias importantes:
 * 1. conteudo invalido nunca derruba a aplicacao — o loader isola o arquivo com
 *    problema, registra o motivo e segue com o resto;
 * 2. o formato reflete a regra do produto: cada aula e curta, tem motivo de
 *    existir e termina em alguma coisa para fazer.
 */

const id = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids usam apenas minusculas, numeros e hifen')

const tags = z.array(z.string().min(1).max(40)).max(12).default([])

export const languageSchema = z
  .enum([
    'text',
    'python',
    'javascript',
    'typescript',
    'html',
    'css',
    'sql',
    'bash',
    'json',
    'yaml',
    'java',
    'php',
    'diff',
  ])
  .default('text')

export type ContentLanguage = z.infer<typeof languageSchema>

// --- Blocos de conteudo ------------------------------------------------------
// Blocos pequenos e explicitos. Nada de HTML livre: o texto aceita apenas
// marcacao inline simples (`codigo`, **forte**, [link](url)) renderizada por
// src/components/conteudo/texto-inline.tsx, sem dangerouslySetInnerHTML.

const textBlock = z.object({
  kind: z.literal('text'),
  text: z.string().min(1).max(1400),
})

const codeBlock = z.object({
  kind: z.literal('code'),
  language: languageSchema,
  code: z.string().min(1).max(4000),
  caption: z.string().max(200).optional(),
  /** Linhas a destacar (1-indexadas). Usado para apontar o ponto do problema. */
  highlight: z.array(z.number().int().positive()).max(20).optional(),
})

const listBlock = z.object({
  kind: z.literal('list'),
  ordered: z.boolean().default(false),
  items: z.array(z.string().min(1).max(400)).min(1).max(12),
})

const calloutBlock = z.object({
  kind: z.literal('callout'),
  // `danger` e reservado para risco tecnico real (perda de dado, falha, brecha).
  tone: z.enum(['info', 'warn', 'danger']).default('info'),
  title: z.string().max(80).optional(),
  text: z.string().min(1).max(700),
})

const terminalBlock = z.object({
  kind: z.literal('terminal'),
  lines: z.array(z.string().max(300)).min(1).max(25),
  caption: z.string().max(200).optional(),
})

const tableBlock = z.object({
  kind: z.literal('table'),
  headers: z.array(z.string().max(60)).min(2).max(4),
  rows: z.array(z.array(z.string().max(200)).min(2).max(4)).min(1).max(12),
  caption: z.string().max(200).optional(),
})

/** Checkpoint dentro da aula. E exercicio, nao prova: mostra a resposta na hora. */
const quizBlock = z.object({
  kind: z.literal('quiz'),
  question: z.string().min(5).max(400),
  choices: z.array(z.string().min(1).max(300)).min(2).max(5),
  answerIndex: z.number().int().min(0),
  explanation: z.string().min(5).max(600),
})

export const blockSchema = z.discriminatedUnion('kind', [
  textBlock,
  codeBlock,
  listBlock,
  calloutBlock,
  terminalBlock,
  tableBlock,
  quizBlock,
])

export type ContentBlock = z.infer<typeof blockSchema>

// --- Exercicios --------------------------------------------------------------

/**
 * Caso de teste. Roda com o codigo da pessoa em escopo:
 * `expression` e avaliada e comparada com `expected` (igualdade estrutural).
 * O mesmo formato serve para o runner de JavaScript e para o de Python.
 */
const testCaseSchema = z.object({
  name: z.string().min(1).max(120),
  expression: z.string().min(1).max(600),
  expected: z.unknown(),
  /** Quando true, o teste passa se a avaliacao lancar erro. */
  expectThrows: z.boolean().default(false),
  /** Nao mostrar o caso antes de rodar (usado em avaliacao). */
  hidden: z.boolean().default(false),
})

export type TestCase = z.infer<typeof testCaseSchema>

/**
 * Verificacao estrutural: usada quando nao ha runtime disponivel para a
 * linguagem (SQL, HTML, configuracao). Nao prova que o codigo funciona e a
 * interface diz isso com clareza.
 */
const structuralCheckSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['contains', 'notContains', 'regex', 'minLines']),
  value: z.string().min(1).max(300),
  /** Mensagem mostrada quando a verificacao falha. Aponta o caminho, nao a resposta. */
  hint: z.string().max(300).optional(),
  caseSensitive: z.boolean().default(false),
})

export type StructuralCheck = z.infer<typeof structuralCheckSchema>

export const exerciseSchema = z.object({
  id,
  title: z.string().min(3).max(140),
  // code: roda testes de verdade. structural: verificacao por padrao.
  // quiz: alternativa com correcao imediata. reflection: registro escrito.
  kind: z.enum(['code', 'structural', 'quiz', 'reflection']),
  language: languageSchema,
  estimatedMinutes: z.number().int().min(1).max(45).default(5),
  prompt: z.string().min(10).max(1200),
  /** Codigo inicial no editor. */
  starter: z.string().max(3000).default(''),
  expectedResult: z.string().max(600).optional(),
  tests: z.array(testCaseSchema).max(12).default([]),
  checks: z.array(structuralCheckSchema).max(12).default([]),
  /** Dicas progressivas: cada uma reduz a dificuldade sem entregar a resposta. */
  hints: z.array(z.string().min(5).max(400)).max(4).default([]),
  solution: z.string().max(3000).optional(),
  solutionNotes: z.string().max(900).optional(),
  choices: z.array(z.string().min(1).max(300)).max(5).optional(),
  answerIndex: z.number().int().min(0).optional(),
  explanation: z.string().max(700).optional(),
})

export type Exercise = z.infer<typeof exerciseSchema>

// --- Aula --------------------------------------------------------------------

const commonErrorSchema = z.object({
  error: z.string().min(3).max(300),
  why: z.string().min(3).max(500),
  fix: z.string().min(3).max(500),
})

export const lessonSchema = z.object({
  id,
  type: z.literal('lesson').default('lesson'),
  title: z.string().min(3).max(140),
  estimatedMinutes: z.number().int().min(3).max(30).default(10),
  tags,
  /** "Por que isso existe?" — uma frase. Se nao da para responder, a aula nao precisa existir. */
  why: z.string().min(10).max(400),
  /** "O que voce vai fazer" — resultado concreto da aula. */
  goal: z.string().min(10).max(400),
  blocks: z.array(blockSchema).min(1).max(24),
  /** "Tente agora" — sempre existe alguma coisa para fazer, mesmo em aula curta. */
  tryNow: z
    .object({
      instructions: z.string().min(10).max(900),
      expected: z.string().max(600).optional(),
    })
    .optional(),
  /** "Se travar" */
  ifStuck: z.array(z.string().min(5).max(400)).max(5).default([]),
  commonErrors: z.array(commonErrorSchema).max(5).default([]),
  exercise: exerciseSchema.optional(),
  /** Termos do glossario citados aqui. Viram link contextual, sem sair da tela. */
  glossary: z.array(z.string().min(2).max(60)).max(10).default([]),
})

export type Lesson = z.infer<typeof lessonSchema>

/** Ponto de parada do modulo: junta o que foi visto e aponta o que vem. */
export const checkpointSchema = z.object({
  id,
  type: z.literal('checkpoint'),
  title: z.string().min(3).max(140),
  estimatedMinutes: z.number().int().min(2).max(20).default(5),
  tags,
  summary: z.string().min(10).max(700),
  learned: z.array(z.string().min(3).max(300)).min(1).max(10),
  nextUp: z.string().max(400).optional(),
})

export type Checkpoint = z.infer<typeof checkpointSchema>

export const moduleItemSchema = z.discriminatedUnion('type', [
  lessonSchema.extend({ type: z.literal('lesson') }),
  checkpointSchema,
])

export type ModuleItem = z.infer<typeof moduleItemSchema>

// --- Avaliacoes --------------------------------------------------------------

const choiceQuestionSchema = z.object({
  id,
  kind: z.enum(['conceitual', 'codigo', 'debugging', 'situacao']),
  prompt: z.string().min(10).max(900),
  code: z.object({ language: languageSchema, code: z.string().min(1).max(2000) }).optional(),
  choices: z.array(z.string().min(1).max(400)).min(3).max(5),
  answerIndex: z.number().int().min(0),
  /** Explicacao curta do raciocinio. Sem elogio e sem linguagem motivacional. */
  explanation: z.string().min(10).max(800),
  /** Por que cada alternativa errada nao serve, quando isso ajuda. */
  wrongExplanations: z.record(z.string(), z.string().max(400)).optional(),
  topics: z.array(z.string().min(2).max(60)).min(1).max(5),
})

const practicalQuestionSchema = z.object({
  id,
  kind: z.literal('pratica'),
  prompt: z.string().min(10).max(1200),
  language: languageSchema,
  starter: z.string().max(3000).default(''),
  code: z.object({ language: languageSchema, code: z.string().min(1).max(2000) }).optional(),
  tests: z.array(testCaseSchema).max(12).default([]),
  checks: z.array(structuralCheckSchema).max(12).default([]),
  hints: z.array(z.string().min(5).max(400)).max(4).default([]),
  criteria: z.array(z.string().min(3).max(300)).max(8).default([]),
  topics: z.array(z.string().min(2).max(60)).min(1).max(5),
  solution: z.string().max(3000).optional(),
})

export const questionSchema = z.discriminatedUnion('kind', [
  choiceQuestionSchema.extend({ kind: z.literal('conceitual') }),
  choiceQuestionSchema.extend({ kind: z.literal('codigo') }),
  choiceQuestionSchema.extend({ kind: z.literal('debugging') }),
  choiceQuestionSchema.extend({ kind: z.literal('situacao') }),
  practicalQuestionSchema,
])

export type Question = z.infer<typeof questionSchema>

export const assessmentSchema = z.object({
  id,
  title: z.string().min(3).max(140),
  format: z.enum(['alternativa', 'pratica']),
  summary: z.string().min(10).max(500),
  estimatedMinutes: z.number().int().min(5).max(60).default(10),
  topics: z.array(z.string().min(2).max(60)).min(1).max(10),
  /** Aparece depois deste item do modulo. Controla quando a avaliacao e oferecida. */
  afterItemId: z.string().max(80).optional(),
  questions: z.array(questionSchema).min(1).max(12),
})

export type Assessment = z.infer<typeof assessmentSchema>

// --- Modulo ------------------------------------------------------------------

export const moduleSchema = z.object({
  id,
  semester: z.number().int().min(1).max(4),
  order: z.number().int().min(0).max(50).default(0),
  title: z.string().min(3).max(140),
  summary: z.string().min(10).max(600),
  /** O que a pessoa consegue fazer depois deste modulo. Resultado, nao ementa. */
  outcome: z.string().min(10).max(500),
  tags,
  stack: z.array(z.string().min(1).max(40)).max(12).default([]),
  items: z.array(moduleItemSchema).min(1).max(80),
  assessments: z.array(assessmentSchema).max(8).default([]),
})

export type ContentModule = z.infer<typeof moduleSchema>

// --- Demandas ----------------------------------------------------------------

export const demandTypeSchema = z.enum([
  'bug',
  'feature',
  'refatoracao',
  'performance',
  'seguranca',
  'banco',
  'api',
  'frontend',
  'backend',
  'integracao',
  'testes',
  'documentacao',
  'devops',
  'manutencao',
  'investigacao',
  'code-review',
])

export type DemandType = z.infer<typeof demandTypeSchema>

export const difficultySchema = z.enum(['iniciante', 'intermediario', 'avancado'])

export const demandSchema = z.object({
  id,
  title: z.string().min(5).max(140),
  type: demandTypeSchema,
  difficulty: difficultySchema,
  estimatedMinutes: z.number().int().min(10).max(240).default(40),
  /** `incompleto` significa que a demanda nao entrega o problema pronto. */
  contextQuality: z.enum(['completo', 'incompleto']).default('completo'),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
  requester: z.string().min(2).max(80),
  summary: z.string().min(10).max(400),
  /** Situacao que motivou o pedido, do ponto de vista de quem pediu. */
  context: z.string().min(20).max(1600),
  /** O pedido como ele chega. Pode ser vago de proposito. */
  request: z.string().min(10).max(900),
  stack: z.array(z.string().min(1).max(40)).min(1).max(10),
  moduleIds: z.array(z.string().min(2).max(80)).max(8).default([]),
  /**
   * Projeto sobre o qual esta demanda chega.
   *
   * E a unica forma de manutencao do acervo: os cinco projetos sao greenfield
   * e terminam em publicacao, enquanto a tarefa que todo junior recebe e
   * alterar algo que ja existe. Ligar a demanda ao projeto que criou o sistema
   * transforma as duas coisas numa so experiencia, sem conteudo novo.
   */
  continuesProjectId: z.string().min(2).max(80).optional(),
  system: z
    .object({
      description: z.string().max(1200).optional(),
      files: z
        .array(
          z.object({
            path: z.string().min(1).max(160),
            note: z.string().max(300).optional(),
            language: languageSchema.optional(),
            code: z.string().max(4000).optional(),
          }),
        )
        .max(8)
        .default([]),
    })
    .optional(),
  expectedBehavior: z.array(z.string().min(3).max(400)).max(10).default([]),
  acceptance: z.array(z.string().min(3).max(400)).min(1).max(10),
  constraints: z.array(z.string().min(3).max(400)).max(8).default([]),
  /** Material de investigacao para demandas de contexto imperfeito. */
  investigation: z
    .object({
      intro: z.string().max(600).optional(),
      logs: z.array(z.string().max(400)).max(20).default([]),
      queries: z
        .array(z.object({ label: z.string().max(120), sql: z.string().max(900) }))
        .max(6)
        .default([]),
      metrics: z.array(z.object({ label: z.string().max(120), value: z.string().max(120) })).max(8).default([]),
      notes: z.array(z.string().max(400)).max(10).default([]),
    })
    .optional(),
  hints: z.array(z.string().min(5).max(500)).max(4).default([]),
  /** Roteiro de auto-revisao antes de "abrir o PR". */
  reviewChecklist: z.array(z.string().min(3).max(300)).max(12).default([]),
  generated: z.boolean().default(false),
})

export type Demand = z.infer<typeof demandSchema>

// --- Projetos ----------------------------------------------------------------

export const projectStepSchema = z.object({
  id,
  order: z.number().int().min(1).max(30),
  title: z.string().min(3).max(140),
  goal: z.string().min(10).max(600),
  estimatedMinutes: z.number().int().min(15).max(600).default(60),
  tasks: z.array(z.string().min(3).max(400)).min(1).max(14),
  deliverable: z.string().min(5).max(400),
  acceptance: z.array(z.string().min(3).max(300)).max(10).default([]),
  tips: z.array(z.string().min(3).max(400)).max(6).default([]),
  /** Modulos que ajudam nesta etapa. Vira link contextual. */
  moduleIds: z.array(z.string().min(2).max(80)).max(6).default([]),
})

export type ProjectStep = z.infer<typeof projectStepSchema>

export const projectSchema = z.object({
  id,
  title: z.string().min(5).max(140),
  summary: z.string().min(10).max(500),
  /** Problema real que o sistema resolve. Vai para o portfolio. */
  problem: z.string().min(20).max(900),
  difficulty: difficultySchema,
  stack: z.array(z.string().min(1).max(40)).min(1).max(14),
  features: z.array(z.string().min(3).max(200)).min(3).max(20),
  architectureNotes: z.string().max(1200).optional(),
  steps: z.array(projectStepSchema).min(2).max(20),
  portfolio: z.object({
    readmeOutline: z.array(z.string().min(3).max(200)).min(3).max(16),
    linkedinDraft: z.string().min(20).max(1200),
    qualityChecklist: z.array(z.string().min(3).max(200)).min(3).max(20),
  }),
})

export type Project = z.infer<typeof projectSchema>

// --- Desafios ----------------------------------------------------------------

export const challengeSchema = z.object({
  id,
  title: z.string().min(5).max(140),
  category: z.enum([
    'logica',
    'debugging',
    'backend',
    'frontend',
    'banco',
    'api',
    'seguranca',
    'git',
    'arquitetura',
    'performance',
  ]),
  difficulty: difficultySchema,
  estimatedMinutes: z.number().int().min(5).max(180).default(20),
  stack: z.array(z.string().min(1).max(40)).max(10).default([]),
  context: z.string().min(20).max(1200),
  objective: z.string().min(10).max(700),
  constraints: z.array(z.string().min(3).max(300)).max(8).default([]),
  acceptance: z.array(z.string().min(3).max(300)).min(1).max(10),
  starter: z.string().max(3000).default(''),
  language: languageSchema,
  tests: z.array(testCaseSchema).max(12).default([]),
  checks: z.array(structuralCheckSchema).max(12).default([]),
  hints: z.array(z.string().min(5).max(400)).max(4).default([]),
  /**
   * Topicos que este desafio exercita, no mesmo vocabulario dos `topics` das
   * questoes de avaliacao.
   *
   * Serve para a revisao oferecer PRATICA em vez de releitura: quando a
   * avaliacao aponta um topico a revisar, o sistema procura um desafio que o
   * exercite. A ligacao mora no conteudo, nao num mapa dentro do codigo, para
   * nao envelhecer separada dele.
   */
  topics: z.array(z.string().min(2).max(60)).max(5).default([]),
  solution: z.string().max(4000).optional(),
  solutionNotes: z.string().max(1200).optional(),
})

export type Challenge = z.infer<typeof challengeSchema>

// --- Glossario ---------------------------------------------------------------

export const glossaryTermSchema = z.object({
  id,
  term: z.string().min(2).max(80),
  short: z.string().min(10).max(300),
  explanation: z.string().min(20).max(1200),
  example: z.object({ language: languageSchema, code: z.string().max(1200) }).optional(),
  /** Onde a pessoa encontra isso no dia a dia. */
  whereItAppears: z.array(z.string().min(3).max(200)).max(8).default([]),
  related: z.array(z.string().min(2).max(80)).max(10).default([]),
  tags,
})

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>

// --- Trilhas (caminho inicial sugerido no onboarding) ------------------------

export const trackSchema = z.object({
  id,
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(400),
  /** Para quem este caminho faz sentido. */
  forWho: z.string().min(10).max(300),
  /**
   * O que a trilha deixa de fora, em uma frase.
   *
   * Uma trilha cobre de 7 a 9 dos 21 modulos. Sem dizer o que fica de fora,
   * ela deixa a pessoa concluir que terminou a formacao — e a regra 9 do
   * produto e nao afirmar certeza que nao existe.
   */
  naoCobre: z.string().max(400).optional(),
  moduleIds: z.array(z.string().min(2).max(80)).min(1).max(20),
})

export type Track = z.infer<typeof trackSchema>

// --- Arquivos de colecao -----------------------------------------------------

export const demandFileSchema = z.object({ demands: z.array(demandSchema).min(1) })
export const projectFileSchema = z.object({ projects: z.array(projectSchema).min(1) })
export const challengeFileSchema = z.object({ challenges: z.array(challengeSchema).min(1) })
export const glossaryFileSchema = z.object({ terms: z.array(glossaryTermSchema).min(1) })
export const trackFileSchema = z.object({ tracks: z.array(trackSchema).min(1) })
