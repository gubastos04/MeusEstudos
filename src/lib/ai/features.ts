import { z } from 'zod'

/**
 * Funcionalidades de IA: prompts e validacao de entrada.
 *
 * O tom de voz do produto vale tambem para a IA: portugues do Brasil, direto,
 * calmo, sem entusiasmo artificial, sem emoji, frases curtas. A IA aqui e
 * ferramenta de aprendizado, nao maquina de respostas prontas: por padrao ela
 * conduz o raciocinio em vez de entregar a solucao.
 */

const VOZ = [
  'Você é um desenvolvedor sênior que orienta alguém aprendendo programação para o trabalho real.',
  'Escreva em português do Brasil. Direto, calmo, frases curtas.',
  'Sem emoji. Sem elogio. Sem frase motivacional. Sem "parabéns".',
  'Não invente resultados, números ou garantias.',
  'Quando algo depende do contexto do projeto, diga o que precisa ser verificado em vez de supor.',
  'Use markdown simples: parágrafos curtos, listas e blocos de código com a linguagem indicada.',
].join(' ')

export const aiFeatureSchema = z.enum([
  'corretor',
  'explicar',
  'pergunta',
  'gerar-demanda',
  'debugger',
  'code-review',
])

export type AiFeature = z.infer<typeof aiFeatureSchema>

/** Contexto do que a pessoa esta estudando. Enviado pelo cliente, sempre opcional. */
export const aiContextSchema = z
  .object({
    moduleId: z.string().max(80).optional(),
    moduleTitle: z.string().max(140).optional(),
    nodeType: z.string().max(40).optional(),
    nodeId: z.string().max(80).optional(),
    nodeTitle: z.string().max(200).optional(),
    language: z.string().max(30).optional(),
    stack: z.array(z.string().max(40)).max(10).optional(),
    level: z.string().max(40).optional(),
  })
  .default({})

export type AiContext = z.infer<typeof aiContextSchema>

export const aiRequestSchema = z.object({
  feature: aiFeatureSchema,
  context: aiContextSchema,
  /** Texto principal: pergunta, codigo, erro. Limite protege custo e latencia. */
  input: z.string().min(1, 'Escreva algo antes de enviar.').max(8000),
  /** Codigo relacionado, quando separado do texto. */
  code: z.string().max(8000).optional(),
  /** Historico curto, apenas na pergunta livre. */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(8)
    .default([]),
  /** Corretor: pedido explicito para mostrar a solucao. */
  revealSolution: z.boolean().default(false),
})

export type AiRequestInput = z.infer<typeof aiRequestSchema>

function contextLines(context: AiContext): string {
  const parts: string[] = []
  if (context.moduleTitle) parts.push(`Módulo: ${context.moduleTitle}`)
  if (context.nodeTitle) parts.push(`Conteúdo atual: ${context.nodeTitle}`)
  if (context.language) parts.push(`Linguagem: ${context.language}`)
  if (context.stack?.length) parts.push(`Stack: ${context.stack.join(', ')}`)
  if (context.level) parts.push(`Nível declarado: ${context.level}`)
  return parts.length > 0 ? `Contexto do estudo:\n${parts.join('\n')}` : 'Sem contexto de módulo.'
}

export type PromptPlan = {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens: number
  temperature: number
  /** Resposta deve ser JSON validado antes de chegar ao usuario. */
  expectJson: boolean
}

export function buildPrompt(request: AiRequestInput): PromptPlan {
  const context = contextLines(request.context)

  switch (request.feature) {
    case 'corretor':
      return {
        system: [
          VOZ,
          'Sua tarefa é revisar o código de um exercício.',
          'Estrutura da resposta, nesta ordem:',
          '1. "O que está acontecendo" — o problema principal, em uma ou duas frases.',
          '2. "Por que" — a causa.',
          '3. "O que verificar" — passos concretos para a pessoa chegar sozinha na correção.',
          '4. "Riscos" — só se houver risco real (dado perdido, brecha, erro silencioso).',
          request.revealSolution
            ? 'A pessoa pediu a solução: mostre o código corrigido no fim, com um comentário curto no ponto que mudou.'
            : 'NÃO escreva o código corrigido completo. Mostre no máximo a linha exata onde está o problema. Se a pessoa quiser a solução, ela pede.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: [
              context,
              '',
              'Enunciado / o que a pessoa deveria fazer:',
              request.input,
              '',
              'Código enviado:',
              '```' + (request.context.language ?? '') ,
              request.code ?? '',
              '```',
            ].join('\n'),
          },
        ],
        maxTokens: 1100,
        temperature: 0.2,
        expectJson: false,
      }

    case 'explicar':
      return {
        system: [
          VOZ,
          'Explique o mesmo conteúdo de outra forma, para quem não entendeu a primeira.',
          'Use quatro seções curtas, nesta ordem:',
          '1. Em uma frase.',
          '2. Analogia simples (uma só, sem forçar).',
          '3. Em código (exemplo mínimo que roda).',
          '4. Onde isso aparece no trabalho real.',
          'No máximo 350 palavras.',
        ].join('\n'),
        messages: [
          { role: 'user', content: [context, '', 'Conteúdo a explicar de outro jeito:', request.input].join('\n') },
        ],
        maxTokens: 900,
        temperature: 0.4,
        expectJson: false,
      }

    case 'pergunta':
      return {
        system: [
          VOZ,
          'Você responde dúvidas de estudo dentro da plataforma.',
          'Responda a pergunta que foi feita, sem aula extra em volta.',
          'Se a pergunta for ampla, responda o essencial e ofereça o próximo detalhe.',
          'Se a resposta depender de algo que você não sabe sobre o projeto da pessoa, pergunte.',
          'No máximo 300 palavras, salvo quando houver código a mostrar.',
        ].join('\n'),
        messages: [
          ...request.history,
          {
            role: 'user' as const,
            content: [
              context,
              '',
              request.input,
              request.code ? `\nCódigo relacionado:\n\`\`\`\n${request.code}\n\`\`\`` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        maxTokens: 900,
        temperature: 0.4,
        expectJson: false,
      }

    case 'debugger':
      return {
        system: [
          VOZ,
          'A pessoa colou um erro. Seu objetivo é ensinar o processo de diagnóstico, não entregar a correção.',
          'Estrutura da resposta:',
          '1. "O que esse erro diz" — tradução literal da mensagem.',
          '2. "Causas prováveis" — no máximo três, da mais provável para a menos.',
          '3. "Como confirmar" — o que olhar ou imprimir, em ordem, para eliminar cada hipótese.',
          '4. "Se confirmar a primeira hipótese" — o que costuma resolver.',
          'Nunca responda apenas "use X". Explique como a pessoa chega à conclusão sozinha na próxima vez.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: [
              context,
              '',
              'Erro / comportamento observado:',
              request.input,
              request.code ? `\nCódigo relacionado:\n\`\`\`\n${request.code}\n\`\`\`` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        maxTokens: 1100,
        temperature: 0.2,
        expectJson: false,
      }

    case 'code-review':
      return {
        system: [
          VOZ,
          'Faça um code review como em um pull request de time.',
          'Avalie nesta ordem, e só escreva a seção se houver algo concreto a dizer:',
          'Legibilidade, Arquitetura, Segurança, Testes, Performance, Manutenção.',
          'Cada ponto vira um item curto: o que está acontecendo, por que importa, o que fazer.',
          'Separe o que é problema real do que é preferência. Marque preferência como "opcional".',
          'Se o código estiver adequado para o nível, diga isso sem enfeitar.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: [
              context,
              '',
              request.input ? `O que este código deveria fazer:\n${request.input}` : '',
              '',
              'Código:',
              '```' + (request.context.language ?? ''),
              request.code ?? '',
              '```',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        maxTokens: 1400,
        temperature: 0.2,
        expectJson: false,
      }

    case 'gerar-demanda':
      return {
        system: [
          VOZ,
          'Gere UMA demanda de trabalho fictícia, no formato de um ticket de empresa.',
          'A demanda tem de parecer pedido real de time: contexto de negócio, pedido possivelmente impreciso, critérios de aceite verificáveis.',
          'Não crie exercício escolar (calculadora, tabuada, CRUD genérico sem contexto).',
          'Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código.',
          'Formato exato:',
          JSON.stringify(
            {
              title: 'string curta',
              type: 'bug | feature | refatoracao | performance | seguranca | banco | api | frontend | backend | integracao | testes | documentacao | devops | manutencao | investigacao | code-review',
              difficulty: 'iniciante | intermediario | avancado',
              estimatedMinutes: 40,
              contextQuality: 'completo | incompleto',
              priority: 'baixa | media | alta | urgente',
              requester: 'quem pediu (time ou cargo)',
              summary: 'uma frase',
              context: 'situação que motivou o pedido, do ponto de vista de quem pediu',
              request: 'o pedido como ele chega',
              stack: ['tecnologia'],
              expectedBehavior: ['comportamento esperado'],
              acceptance: ['critério verificável'],
              constraints: ['restrição'],
              hints: ['dica opcional que não entrega a solução'],
              reviewChecklist: ['item de autorrevisão antes de abrir o PR'],
            },
            null,
            2,
          ),
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: [context, '', 'Pedido:', request.input].join('\n'),
          },
        ],
        maxTokens: 1600,
        temperature: 0.7,
        expectJson: true,
      }
  }
}

/** Rotulos usados na interface. */
export const featureLabels: Record<AiFeature, string> = {
  corretor: 'Corretor',
  explicar: 'Explicar de outro jeito',
  pergunta: 'Pergunta livre',
  'gerar-demanda': 'Gerar demanda',
  debugger: 'Debugger',
  'code-review': 'Code review',
}
