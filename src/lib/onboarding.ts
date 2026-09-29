import { z } from 'zod'

/**
 * Avaliacao inicial (spec 62).
 *
 * Cinco perguntas, nenhuma obrigatoria a nao ser a primeira. O objetivo e
 * escolher um caminho inicial razoavel, nao classificar ninguem. A pessoa pode
 * trocar de trilha depois, no perfil.
 */

export const respostaOnboardingSchema = z.object({
  hasProgrammedBefore: z.enum(['nunca', 'pouco', 'ja_programei', 'trabalho_na_area']),
  knownLanguages: z.array(z.string().min(1).max(30)).max(10).default([]),
  usedGit: z.enum(['nunca', 'pouco', 'sim']).default('nunca'),
  usedDatabase: z.enum(['nunca', 'pouco', 'sim']).default('nunca'),
  typicalMinutes: z.union([z.literal(10), z.literal(20), z.literal(45)]).default(20),
  goal: z.enum(['primeiro_emprego', 'recomecar', 'melhorar', 'curiosidade']).optional(),
  /** A pessoa pode escolher a trilha em vez de aceitar a sugestao. */
  trackId: z.string().max(80).optional(),
})

export type RespostaOnboarding = z.infer<typeof respostaOnboardingSchema>

export const perguntas = {
  hasProgrammedBefore: {
    rotulo: 'Você já programou antes?',
    ajuda: 'Responda com honestidade. O caminho muda bastante com essa resposta.',
    opcoes: [
      { valor: 'nunca', rotulo: 'Nunca', detalhe: 'Vamos começar do começo mesmo.' },
      { valor: 'pouco', rotulo: 'Só tutoriais soltos', detalhe: 'Já vi código, mas nunca construí nada.' },
      { valor: 'ja_programei', rotulo: 'Já programei e parei', detalhe: 'Preciso recuperar a base.' },
      { valor: 'trabalho_na_area', rotulo: 'Trabalho com isso', detalhe: 'Quero preencher lacunas.' },
    ],
  },
  usedGit: {
    rotulo: 'Já usou Git?',
    opcoes: [
      { valor: 'nunca', rotulo: 'Nunca' },
      { valor: 'pouco', rotulo: 'Só o básico', detalhe: 'commit e push, seguindo instruções.' },
      { valor: 'sim', rotulo: 'Sim', detalhe: 'Branch, pull request, resolver conflito.' },
    ],
  },
  usedDatabase: {
    rotulo: 'Já trabalhou com banco de dados?',
    opcoes: [
      { valor: 'nunca', rotulo: 'Nunca' },
      { valor: 'pouco', rotulo: 'Só consultas simples' },
      { valor: 'sim', rotulo: 'Sim', detalhe: 'Modelagem, junção, índice.' },
    ],
  },
  typicalMinutes: {
    rotulo: 'Quanto tempo você costuma ter por vez?',
    ajuda: 'Isso define o tamanho do que a plataforma sugere. Não é compromisso: pode variar todo dia.',
    opcoes: [
      { valor: '10', rotulo: '10 minutos', detalhe: 'Um bloco curto, um exercício, uma revisão.' },
      { valor: '20', rotulo: '20 minutos', detalhe: 'Um conteúdo inteiro com prática.' },
      { valor: '45', rotulo: 'Mais de 40 minutos', detalhe: 'Dá para avançar em demanda ou projeto.' },
    ],
  },
  goal: {
    rotulo: 'O que você quer com isso?',
    opcoes: [
      { valor: 'primeiro_emprego', rotulo: 'Primeiro emprego na área' },
      { valor: 'recomecar', rotulo: 'Recomeçar depois de um tempo parado' },
      { valor: 'melhorar', rotulo: 'Melhorar no que já faço' },
      { valor: 'curiosidade', rotulo: 'Curiosidade, sem pressa' },
    ],
  },
} as const

export const linguagensComuns = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'PHP',
  'C',
  'C#',
  'SQL',
  'HTML e CSS',
]

/**
 * Sugere uma trilha a partir das respostas.
 *
 * Decisao simples e explicavel de proposito: a pessoa vê o motivo da sugestao e
 * pode trocar. Nada de pontuacao escondida.
 */
export function sugerirTrilha(resposta: {
  hasProgrammedBefore: RespostaOnboarding['hasProgrammedBefore']
  usedGit: RespostaOnboarding['usedGit']
  usedDatabase: RespostaOnboarding['usedDatabase']
  goal?: RespostaOnboarding['goal']
}): { trackId: string; motivo: string } {
  const { hasProgrammedBefore, usedGit, usedDatabase } = resposta

  if (hasProgrammedBefore === 'nunca') {
    return {
      trackId: 'comeco-do-zero',
      motivo: 'Você marcou que nunca programou, então o caminho começa pela lógica antes da linguagem.',
    }
  }

  if (hasProgrammedBefore === 'pouco') {
    return {
      trackId: 'comeco-do-zero',
      motivo:
        'Tutoriais soltos costumam deixar buracos de base. O caminho começa do início, mas você vai avançar rápido nos primeiros módulos.',
    }
  }

  const baseSolida = usedGit === 'sim' && usedDatabase === 'sim'

  if (hasProgrammedBefore === 'trabalho_na_area' && baseSolida) {
    return {
      trackId: 'foco-backend',
      motivo: 'Você já tem base de Git e banco, então o caminho vai direto para API, segurança e deploy.',
    }
  }

  if (hasProgrammedBefore === 'trabalho_na_area') {
    return {
      trackId: 'foco-backend',
      motivo:
        'Como você já trabalha na área, o caminho prioriza o que aparece no dia a dia: API, banco e segurança.',
    }
  }

  return {
    trackId: 'recomecando',
    motivo:
      'Você já programou e parou. O caminho retoma a base rápido e vai para o que aparece no trabalho: Git, API e banco.',
  }
}

/** Texto do primeiro passo, mostrado ao final do início rápido. */
export function mensagemDeBoasVindas(minutos: number): string {
  if (minutos <= 10) {
    return 'Seus blocos vão ser curtos. Dá para concluir um por vez, sem deixar nada pela metade.'
  }
  if (minutos <= 20) {
    return 'Com 20 minutos dá para fazer um conteúdo inteiro com a prática no fim.'
  }
  return 'Com esse tempo dá para avançar em demanda e projeto, não só em conteúdo.'
}
