import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { getAssessment } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'
import { resumirTentativa } from '@/lib/avaliacoes'
import { runStructuralChecks } from '@/lib/runner/structural'
import { bumpActivity, logEvent } from '@/lib/progress'

/**
 * Fluxo de uma avaliacao: iniciar, responder cada item, finalizar.
 *
 * Correcao de alternativa acontece AQUI, no servidor. O gabarito nunca vai para
 * o navegador antes da resposta, e a explicacao so e devolvida depois.
 *
 * Em questao pratica, os testes rodam no navegador (a plataforma nao executa
 * codigo de usuario no servidor). O servidor reexecuta as verificacoes
 * estruturais, que sao deterministicas, e registra o resultado informado.
 *
 * Tentativas anteriores nunca sao apagadas: o historico mostra evolucao.
 */

const schema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('iniciar') }),
  z.object({
    acao: z.literal('responder'),
    tentativaId: z.string().min(1).max(60),
    questaoId: z.string().min(1).max(80),
    escolha: z.number().int().min(0).max(10).optional(),
    codigo: z.string().max(20000).optional(),
    passouTestes: z.boolean().optional(),
    casosPassaram: z.number().int().min(0).max(100).optional(),
    totalCasos: z.number().int().min(0).max(100).optional(),
    dicasUsadas: z.number().int().min(0).max(10).default(0),
  }),
  z.object({ acao: z.literal('finalizar'), tentativaId: z.string().min(1).max(60) }),
])

export const POST = handler({ schema }, async ({ user, body, params }) => {
  const avaliacaoId = params.id ?? ''
  const avaliacao = getAssessment(avaliacaoId)

  if (!avaliacao) {
    return fail('Avaliação não encontrada.', 404)
  }

  if (body.acao === 'iniciar') {
    const anteriores = await db.assessmentAttempt.count({
      where: { userId: user.id, assessmentId: avaliacao.id },
    })

    const tentativa = await db.assessmentAttempt.create({
      data: {
        userId: user.id,
        assessmentId: avaliacao.id,
        attemptNumber: anteriores + 1,
        format: avaliacao.format,
        totalItems: avaliacao.questions.length,
      },
    })

    return ok({ tentativaId: tentativa.id, numero: tentativa.attemptNumber }, 201)
  }

  // As duas acoes seguintes exigem uma tentativa que pertenca a este usuario.
  const tentativa = await db.assessmentAttempt.findFirst({
    where: { id: body.tentativaId, userId: user.id, assessmentId: avaliacao.id },
  })

  if (!tentativa) {
    return fail('Tentativa não encontrada.', 404)
  }

  if (body.acao === 'responder') {
    if (tentativa.status === 'finished') {
      return fail('Esta tentativa já foi finalizada.', 409)
    }

    const questao = avaliacao.questions.find((item) => item.id === body.questaoId)
    if (!questao) {
      return fail('Questão não encontrada.', 404)
    }

    // Uma resposta por questao por tentativa.
    const jaRespondida = await db.answer.findFirst({
      where: { attemptId: tentativa.id, questionId: questao.id },
    })
    if (jaRespondida) {
      return fail('Esta questão já foi respondida nesta tentativa.', 409)
    }

    if (questao.kind !== 'pratica') {
      if (body.escolha === undefined) {
        return fail('Escolha uma alternativa.', 422, { campo: 'escolha' })
      }

      const correta = body.escolha === questao.answerIndex

      await db.answer.create({
        data: {
          attemptId: tentativa.id,
          userId: user.id,
          questionId: questao.id,
          choiceIndex: body.escolha,
          correct: correta,
          totalCases: 1,
          passedCases: correta ? 1 : 0,
        },
      })

      // A explicacao e devolvida somente agora, depois da resposta.
      return ok({
        correta,
        indiceCorreto: questao.answerIndex,
        explicacao: questao.explanation,
        porQueNao:
          !correta && questao.wrongExplanations
            ? (questao.wrongExplanations[String(body.escolha)] ?? null)
            : null,
      })
    }

    // Questao pratica.
    const codigo = body.codigo ?? ''
    const estruturais = questao.checks.length > 0 ? runStructuralChecks(codigo, questao.checks) : []
    const estruturaisOk = estruturais.every((caso) => caso.passed)

    // Quantos casos a questao tem e informacao do servidor: ele conhece a
    // questao. Do cliente vem apenas quantos passaram, limitado ao que existe —
    // sem isso um cliente modificado gravaria 99 de 0, um registro impossivel.
    const totalDeTestes = questao.tests.length
    const casosInformados = Math.min(Math.max(body.casosPassaram ?? 0, 0), totalDeTestes)

    const testesOk = totalDeTestes === 0 ? true : Boolean(body.passouTestes)
    const correta = testesOk && estruturaisOk && codigo.trim().length > 0

    await db.answer.create({
      data: {
        attemptId: tentativa.id,
        userId: user.id,
        questionId: questao.id,
        code: codigo.slice(0, 20000),
        correct: correta,
        totalCases: totalDeTestes + estruturais.length,
        passedCases: casosInformados + estruturais.filter((caso) => caso.passed).length,
        // O registro distingue o que o servidor verificou do que recebeu: codigo
        // de quem estuda nunca roda aqui, entao o resultado dos testes chega do
        // navegador. Guardar os dois como iguais seria afirmar uma certeza que
        // nao existe (regra 9 do produto, aplicada ao dado e nao so a tela).
        report: toJson([
          ...estruturais.map((caso) => ({ nome: caso.name, passou: caso.passed, modo: 'estrutura' })),
          ...(totalDeTestes > 0
            ? [
                {
                  nome: `${casosInformados} de ${totalDeTestes} casos`,
                  passou: testesOk,
                  modo: 'execucao-informada',
                },
              ]
            : []),
        ]),
        hintsUsed: body.dicasUsadas,
      },
    })

    return ok({
      correta,
      verificacoesEstruturais: estruturais.map((caso) => ({
        nome: caso.name,
        passou: caso.passed,
        mensagem: caso.message ?? null,
      })),
      criterios: questao.criteria,
    })
  }

  // Finalizar.
  if (tentativa.status === 'finished') {
    return fail('Esta tentativa já foi finalizada.', 409)
  }

  const respostas = await db.answer.findMany({
    where: { attemptId: tentativa.id },
    select: { questionId: true, correct: true },
  })

  const resumo = resumirTentativa(avaliacao, respostas)

  await db.assessmentAttempt.update({
    where: { id: tentativa.id },
    data: {
      status: 'finished',
      finishedAt: new Date(),
      totalItems: avaliacao.questions.length,
      correctItems: resumo.corretas,
      strongTopics: toJson(resumo.topicosDemonstrados),
      reviewTopics: toJson(resumo.topicosParaRevisar),
    },
  })

  await bumpActivity(user.id, { assessmentsTaken: 1 })
  await logEvent({
    userId: user.id,
    type: 'assessment_finished',
    nodeType: 'assessment',
    nodeId: avaliacao.id,
    meta: { corretas: resumo.corretas, total: avaliacao.questions.length },
  })

  return ok({
    total: avaliacao.questions.length,
    respondidas: respostas.length,
    corretas: resumo.corretas,
    topicosDemonstrados: resumo.topicosDemonstrados,
    topicosParaRevisar: resumo.topicosParaRevisar,
  })
})
